const cds = require('@sap/cds');
const crypto = require("crypto");
const { SELECT } = cds;

module.exports = cds.service.impl(async function () {

    const { Samples } = this.entities;  // ✅ Changed: Sample → Samples

    // Shared function to determine overdue status
    const determineOverdueStatus = (data) => {
        if (data.dueDate) {
            const due = new Date(data.dueDate);
            const today = new Date();
            today.setHours(0,0,0,0);
            due.setHours(0,0,0,0);
            data.overdueStatusIcon = due < today ? '🔴' : '🟢';
        }
    };

    // Before Read to expand costOfSample and account safely
    this.before('READ', Samples, (req) => { 
        const sel = req.query && req.query.SELECT;
        if (!sel) return; // nothing to change for non-SELECT requests

        console.log('=== BEFORE READ DEBUG ===');

        // Initialize columns if not present
        if (!sel.columns) sel.columns = [];

        
        const scalarFields = [
            'id', 'createdAt', 'createdBy', 'modifiedAt', 'modifiedBy',
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
        
        if (!result || !result.id) {
            console.log('No result or id found, returning original result');
            return result;
        }

        try {
            console.log('PATCH operation - fetching complete entity with all fields');
            
            
            const completeEntity = await cds.run(
                SELECT.from(Samples)  // ✅ Changed: Sample → Samples
                    .where({ id: result.id })
                    .columns([
                        'id', 'createdAt', 'createdBy', 'modifiedAt', 'modifiedBy',
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
                if (entity.account && entity.account.accountId) {
                    try {
                        const accountApi = await cds.connect.to("Account.Service");
                        const accountResponse = await accountApi.send({
                            method: "GET",
                            path: `/sap/c4c/api/v1/account-service/accounts/${entity.account.accountId}?$select=displayId,id,formattedName`
                        });
                        
                        if (accountResponse?.value) {
                            entity.account = {
                                accountId: accountResponse.value.id,
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
                    console.log('No accountId present, skipping account enrichment in PATCH');
                }

                // Enrich with product data
                if (entity.product && entity.product.productId) {
                    try {
                        const productApi = await cds.connect.to("Product.Service");
                        const productResponse = await productApi.send({
                            method: "GET",
                            path: `/sap/c4c/api/v1/product-service/products/${entity.product.productId}?$select=displayId,id,name`
                        });
                        
                        if (productResponse?.value) {
                            entity.product = {
                                productId: productResponse.value.id,
                                name: productResponse.value.name,
                                displayId: productResponse.value.displayId
                            };
                            console.log("Product enrichment completed for PATCH response");
                        }
                    } catch (err) {
                        console.log('Product enrichment failed in PATCH (non-critical):', err.message);
                        // Continue without enrichment - product stays as-is
                    }
                } else {
                    console.log('No productId present, skipping product enrichment in PATCH');
                }

                // Enrich with employee data
                if (entity.employee && entity.employee.employeeId) {
                    try {
                        const productApi = await cds.connect.to("Product.Service");
                        const employeeResponse = await productApi.send({
                            method: "GET",
                            path: `/sap/c4c/api/v1/employee-service/employees/${entity.employee.employeeId}?$select=displayId,id,formattedName`
                        });
                        
                        if (employeeResponse?.value) {
                            entity.employee = {
                                employeeId: employeeResponse.value.id,
                                name: employeeResponse.value.formattedName,
                                displayId: employeeResponse.value.displayId
                            };
                            console.log("Employee enrichment completed for PATCH response");
                        }
                    } catch (err) {
                        console.log('Employee enrichment failed in PATCH (non-critical):', err.message);
                        // Continue without enrichment - employee stays as-is
                    }
                } else {
                    console.log('No employeeId present, skipping employee enrichment in PATCH');
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
            // === Account Enrichment ===
            const accountApi = await cds.connect.to("Account.Service");
            const accountRequestList = [];
            const accountSampleIndexMap = []; // Track which samples have accounts

            // forming batch call - only for samples that have accountId
            samples?.forEach((sa, index) => {  
                if (!(sa.account && sa.account.accountId)) {
                    console.log(`Sample at index ${index} has no accountId, skipping account enrichment`);
                    return;
                }
                let accountCnsEndPoint = `/sap/c4c/api/v1/account-service/accounts/${sa.account.accountId}?$select=displayId,id,formattedName`;
                accountRequestList.push({
                    "id": 'accountCns_' + accountRequestList.length,
                    "url": accountCnsEndPoint,
                    "method": "GET"
                });
                accountSampleIndexMap.push(index); // Store original sample index
            });

            // Process account batch if there are any
            if (accountRequestList.length > 0) {
                try {
                    const accountDataBatchResp = await accountApi.send({
                        method: "POST",
                        path: `$batch`,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        data: {
                            "requests": accountRequestList
                        }
                    });

                    accountDataBatchResp.responses.forEach((eachAccDtl, batchIndex) => {
                        if (eachAccDtl?.body?.value) {
                            const originalSampleIndex = accountSampleIndexMap[batchIndex];
                            samples[originalSampleIndex]['account'] = { 
                                accountId: eachAccDtl.body.value.id,
                                name: eachAccDtl.body.value.formattedName,
                                displayId: eachAccDtl.body.value.displayId
                            };
                            console.log("Account enrichment completed: "+eachAccDtl.body.value.displayId+" "+eachAccDtl.body.value.formattedName);
                        }
                    });
                } catch (err) {
                    console.error("Error during account batch enrichment:", err);
                }
            } else {
                console.log("No accounts to enrich");
            }

            // === Product Enrichment ===
            const productApi = await cds.connect.to("Product.Service");
            const productRequestList = [];
            const productSampleIndexMap = []; // Track which samples have products

            // forming batch call - only for samples that have productId
            samples?.forEach((sa, index) => {  
                if (!(sa.product && sa.product.productId)) {
                    console.log(`Sample at index ${index} has no productId, skipping product enrichment`);
                    return;
                }
                let productCnsEndPoint = `/sap/c4c/api/v1/product-service/products/${sa.product.productId}?$select=displayId,id,name`;
                productRequestList.push({
                    "id": 'productCns_' + productRequestList.length,
                    "url": productCnsEndPoint,
                    "method": "GET"
                });
                productSampleIndexMap.push(index); // Store original sample index
            });

            // Process product batch if there are any
            if (productRequestList.length > 0) {
                try {
                    const productDataBatchResp = await productApi.send({
                        method: "POST",
                        path: `$batch`,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        data: {
                            "requests": productRequestList
                        }
                    });

                    productDataBatchResp.responses.forEach((eachProdDtl, batchIndex) => {
                        if (eachProdDtl?.body?.value) {
                            const originalSampleIndex = productSampleIndexMap[batchIndex];
                            samples[originalSampleIndex]['product'] = { 
                                productId: eachProdDtl.body.value.id,
                                name: eachProdDtl.body.value.name,
                                displayId: eachProdDtl.body.value.displayId
                            };
                            console.log("Product enrichment completed: "+eachProdDtl.body.value.displayId+" "+eachProdDtl.body.value.name);
                        }
                    });
                } catch (err) {
                    console.error("Error during product batch enrichment:", err);
                }
            } else {
                console.log("No products to enrich");
            }

            // === Employee Enrichment ===
            const employeeRequestList = [];
            const employeeSampleIndexMap = []; // Track which samples have employees

            // forming batch call - only for samples that have employeeId
            samples?.forEach((sa, index) => {  
                if (!(sa.employee && sa.employee.employeeId)) {
                    console.log(`Sample at index ${index} has no employeeId, skipping employee enrichment`);
                    return;
                }
                let employeeCnsEndPoint = `/sap/c4c/api/v1/employee-service/employees/${sa.employee.employeeId}?$select=displayId,id,formattedName`;
                employeeRequestList.push({
                    "id": 'employeeCns_' + employeeRequestList.length,
                    "url": employeeCnsEndPoint,
                    "method": "GET"
                });
                employeeSampleIndexMap.push(index); // Store original sample index
            });

            // Process employee batch if there are any
            if (employeeRequestList.length > 0) {
                try {
                    const employeeDataBatchResp = await productApi.send({
                        method: "POST",
                        path: `$batch`,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        data: {
                            "requests": employeeRequestList
                        }
                    });

                    employeeDataBatchResp.responses.forEach((eachEmpDtl, batchIndex) => {
                        if (eachEmpDtl?.body?.value) {
                            const originalSampleIndex = employeeSampleIndexMap[batchIndex];
                            samples[originalSampleIndex]['employee'] = { 
                                employeeId: eachEmpDtl.body.value.id,
                                name: eachEmpDtl.body.value.formattedName,
                                displayId: eachEmpDtl.body.value.displayId
                            };
                            console.log("Employee enrichment completed: "+eachEmpDtl.body.value.displayId+" "+eachEmpDtl.body.value.formattedName);
                        }
                    });
                } catch (err) {
                    console.error("Error during employee batch enrichment:", err);
                }
            } else {
                console.log("No employees to enrich");
            }

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

        // Function to determine overdue status
        determineOverdueStatus(d);
    });

    // Before UPDATE logic
    this.before('UPDATE', Samples, (req) => {
        const d = req.data || {};

        // Function to determine overdue status
        determineOverdueStatus(d);
    });

    
        this.after('CREATE', Samples, async (sample, req) => {
        console.log("🔔 after('CREATE') handler triggered for Timeline event");
        
        // Sending Timeline event - requires prior configuration in the CRM system
        try {
            // Check if account exists before proceeding
            if (!sample.account || !sample.account.accountId) {
                console.log("⚠️ No account data present, skipping Timeline event");
                return; // Skip timeline event if no account
            }

            const inboundDataConnectorService = await cds.connect.to("Timeline.Service");
            const randomUUID = crypto.randomUUID();
            const payload = {
                "id": randomUUID,
                "subject": sample.id,
                "type": "customer.ssc.sampleservice.event.SampleCreate",
                "specversion": "0.2",
                "source": "614cd785fe86ec5c905b4a00",
                "time": new Date().toISOString(), // "2024-11-11T01:10:00.180Z",
                "datacontenttype": "application/json",
                "data": {
                    "currentImage": {
                        "id": sample.id,
                        "sampleName": sample.sampleName,
                        "status": sample.status,
                        "account": {
                            "accountId": sample.account.accountId
                        }
                    }
                }
            }
            
            console.log("📤 Sending Timeline event payload:", JSON.stringify(payload, null, 2));
            
            const sendActionResp = await inboundDataConnectorService.send({
                method: "POST",
                path: `/sap/c4c/api/v1/inbound-data-connector-service/events`,
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "*/*"
                },
                data: payload
            });
            
            console.log("✅ Timeline event sent successfully. Response:", JSON.stringify(sendActionResp, null, 2));
        } catch (err) {
            console.error("❌ Timeline event failed:", err.message);
            // Don't reject - just log error and continue (non-critical)
            console.log("Timeline event is optional, continuing with sample creation");
        }
    });

});