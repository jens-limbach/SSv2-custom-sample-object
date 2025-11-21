const cds = require('@sap/cds');
const crypto = require("crypto");
const { SELECT } = cds;

module.exports = cds.service.impl(async function () {

    const { Samples } = this.entities;  // ✅ Changed: Sample → Samples

    // Before Read to expand costOfSample and account safely
    this.before('READ', Samples, (req) => { 
        const sel = req.query && req.query.SELECT;
        if (!sel) return; // nothing to change for non-SELECT requests

        console.log('=== BEFORE READ DEBUG ===');

        // Initialize columns if not present
        if (!sel.columns) sel.columns = [];

        
        const scalarFields = [
            'ID', 'createdAt', 'createdBy', 'modifiedAt', 'modifiedBy',
            'sampleName', 'sampleType', 'shipToAddress',
            'hazardous', 'hazardousReason', 'dueDate', 'overdueStatusIcon', 'status',
            'packagingHeight', 'packagingWidth', 'packagingMaterial'
        ];

        // Add scalar fields if they don't exist
        scalarFields.forEach(field => {
            const exists = sel.columns.some(col => 
                col && col.ref && col.ref[0] === field);
            if (!exists) {
                sel.columns.push({ ref: [field] });
            }
        });

        // Add navigation expansions
        const ensureNavExpand = (nav) => {
            const exists = sel.columns.some(col => {
                return col && col.ref && Array.isArray(col.ref) && col.ref[0] === nav;
            });
            if (!exists) {
                sel.columns.push({ ref: [nav], expand: ['*'] });
            }
        };

        // Always ensure these specific expansions are available for after('READ') logic
        ensureNavExpand('costOfSample');
        ensureNavExpand('account');
        ensureNavExpand('numberOfSamples');
        ensureNavExpand('product');
        ensureNavExpand('employee');
        ensureNavExpand('opportunity');
        ensureNavExpand('serviceCase');

        console.log('Columns after modification:', sel.columns.map(col => col.ref));
    });

    // After UPDATE (PATCH) - return complete entity with all fields
    this.after('UPDATE', Samples, async (result, req) => {  
        console.log('🔥 after(UPDATE) handler triggered!');
        
        if (!result || !result.ID) {
            console.log('No result or ID found, returning original result');
            return result;
        }

        try {
            console.log('PATCH operation - fetching complete entity with all fields');
            
            
            const completeEntity = await cds.run(
                SELECT.from(Samples)  // ✅ Changed: Sample → Samples
                    .where({ ID: result.ID })
                    .columns([
                        'ID', 'createdAt', 'createdBy', 'modifiedAt', 'modifiedBy',
                        'sampleName', 'sampleType', 'shipToAddress',
                        'hazardous', 'hazardousReason', 'dueDate', 'overdueStatusIcon', 'status',
                        'packagingHeight', 'packagingWidth', 'packagingMaterial', 
                        { ref: ['costOfSample'], expand: ['*'] },
                        { ref: ['account'], expand: ['*'] },
                        { ref: ['numberOfSamples'], expand: ['*'] },
                        { ref: ['product'], expand: ['*'] },
                        { ref: ['employee'], expand: ['*'] },
                        { ref: ['opportunity'], expand: ['*'] },
                        { ref: ['serviceCase'], expand: ['*'] }
                    ])
            );

            if (completeEntity && completeEntity.length > 0) {
                const entity = completeEntity[0];
                
                // Enrich with account data using the same logic as after('READ')
                if (entity.account && entity.account.accountID) {
                    try {
                        const accountApi = await cds.connect.to("Account.Service");
                        const accountResponse = await accountApi.send({
                            method: "GET",
                            path: `/sap/c4c/api/v1/account-service/accounts/${entity.account.accountID}?$select=displayId,id,formattedName`
                        });
                        
                        if (accountResponse?.value) {
                            entity.account = {
                                accountID: accountResponse.value.id,
                                name: accountResponse.value.formattedName,
                                displayId: accountResponse.value.displayId
                            };
                            console.log("Account enrichment completed for PATCH response");
                        }
                    } catch (err) {
                        console.log('Account enrichment failed in PATCH (non-critical):', err.message);
                        // Continue without enrichment - account stays as-is
                    }
                } else {
                    console.log('No accountID present, skipping account enrichment in PATCH');
                }
                
                return entity;
            }
        } catch (error) {
            console.error('Error in after UPDATE handler:', error);
        }

        return result;
    });

    // After Read to enrich account and product details
    this.after('READ', 'Samples', async (samples, req) => {  // ✅ Changed: 'Sample' → 'Samples'
        console.log("After.Read for sample was started");

        // Skip if there are no samples
        if (!samples || samples.length === 0) {  
            return samples;
        }

        try {
            const accountApi = await cds.connect.to("Account.Service");
            const requestList2 = [];
            const sampleIndexMap = []; // Track which samples have accounts

            // forming batch call - only for samples that have accountID
            samples?.forEach((sa, index) => {  
                if (!(sa.account && sa.account.accountID)) {
                    console.log(`Sample at index ${index} has no accountID, skipping enrichment`);
                    return;
                }
                let accountCnsEndPoint = `/sap/c4c/api/v1/account-service/accounts/${sa.account.accountID}?$select=displayId,id,formattedName`;
                requestList2.push({
                    "id": 'accountCns_' + requestList2.length,
                    "url": accountCnsEndPoint,
                    "method": "GET"
                });
                sampleIndexMap.push(index); // Store original sample index
            });

            // If no accounts to enrich, return samples as-is
            if (requestList2.length === 0) {
                console.log("No accounts to enrich, returning samples as-is");
                return samples;
            }

            const accountDataBatchResp = await accountApi.send({
                method: "POST",
                path: `$batch`,
                headers: {
                    "Content-Type": "application/json",
                },
                data: {
                    "requests": requestList2
                }
            });

            accountDataBatchResp.responses.forEach((eachAccDtl, batchIndex) => {
                if (eachAccDtl?.body?.value) {
                    const originalSampleIndex = sampleIndexMap[batchIndex];
                    samples[originalSampleIndex]['account'] = { 
                        accountID: eachAccDtl.body.value.id,
                        name: eachAccDtl.body.value.formattedName,
                        displayId: eachAccDtl.body.value.displayId
                    };
                    console.log("Account response reached. Some values: "+eachAccDtl.body.value.displayId+" "+eachAccDtl.body.value.formattedName);
                }
            });

            return samples;  
        } catch (err) {
            console.error("Error during account enrichment:", err);
            // Don't reject - just log error and return samples without enrichment
            return samples;
        }    
    });

    // Validate before CREATE (only for root Sample entity)
    this.before('CREATE', Samples, (req) => {  
        // ensure this runs only for the Sample root entity
        if (req.target !== Samples) return; 

        const d = req.data || {};

        if (d.numberOfSamples?.content != null && d.numberOfSamples.content <= 0) {
            return req.reject(400, 'Number of Samples must be greater than zero');
        }

        // ... rest of your validation logic stays the same
        if (d.dueDate && d.sampleName) {
            const due = new Date(d.dueDate);
            const today = new Date();
            today.setHours(0,0,0,0);
            due.setHours(0,0,0,0);
            if (due < today && !d.sampleName.endsWith(' 🔴')) {
                d.sampleName = `${d.sampleName} 🔴`;
            } else if (due >= today && d.sampleName.endsWith(' 🔴')) {
                d.sampleName = d.sampleName.slice(0, -2);
            }
        }
    });

});