const cds = require('@sap/cds');
const crypto = require("crypto");
const { SELECT } = cds;

module.exports = cds.service.impl(async function () {

const { Samples } = this.entities;

 // Before Read to expand costOfSample and account safely
    this.before('READ', Samples, (req) => {
        const sel = req.query && req.query.SELECT;
        if (!sel) return; // nothing to change for non-SELECT requests

        console.log('=== BEFORE READ DEBUG ===');

        // Initialize columns if not present
        if (!sel.columns) sel.columns = [];

        // Add scalar fields for both GET and PATCH operations
        const scalarFields = [
            'ID', 
            'sampleName', 'sampleType', 'numberOfSamples', 'shipToAddress',
            'hazardous', 'hazardousReason', 'dueDate', 'overdueStatusIcon', 'status',
            'PackagingHeight', 'PackagingWidth', 'PackagingMaterial',
            'productUUID', 'accountUUID', 'employeeUUID', 'opportunityUUID', 'serviceCaseUUID'
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
        ensureNavExpand('product');

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
            
            // Re-read the updated entity with all scalar fields and expansions
            const completeEntity = await cds.run(
                SELECT.from(Samples)
                    .where({ ID: result.ID })
                    .columns([
                        // All scalar fields explicitly
                        'ID', 
                        'sampleName', 'sampleType', 'numberOfSamples', 'shipToAddress',
                        'hazardous', 'hazardousReason', 'dueDate', 'overdueStatusIcon', 'status',
                        'PackagingHeight', 'PackagingWidth', 'PackagingMaterial',
                        'productUUID', 'accountUUID', 'employeeUUID', 'opportunityUUID', 'serviceCaseUUID',
                        // Navigation expansions
                        { ref: ['costOfSample'], expand: ['*'] },
                        { ref: ['account'], expand: ['*'] },
                        { ref: ['product'], expand: ['*'] }
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
                                id: accountResponse.value.id,
                                name: accountResponse.value.formattedName,
                                displayId: accountResponse.value.displayId
                            };
                            console.log("Account enrichment completed for PATCH response");
                        }
                    } catch (err) {
                        console.log('Account enrichment failed in PATCH:', err.message);
                    }
                }
                
                return entity;
            }
        } catch (error) {
            console.error('Error in after UPDATE handler:', error);
        }

        return result;
    });

    
 // After Read to enrich account and product details
    this.after('READ', 'Samples', async (Samples, req) => {
       console.log("After.Read for sample was started");


        // Skip if there are no samples
        if (!Samples || Samples.length === 0) {
            return Samples;
        }

        // Enrich account and product details based on a V2 API call
        try {
 
              // Get Account details and add to response
            const accountApi = await cds.connect.to("Account.Service");
            const requestList2 = [];

            // forming batch call
            Samples?.forEach((sa, index) => {
              if (!(sa.account && sa.account.accountID)) return;
                let accountCnsEndPoint = `/sap/c4c/api/v1/account-service/accounts/${sa.account.accountID}?$select=displayId,id,formattedName`;
                requestList2.push({
                    "id": 'accountCns_' + index++,
                    "url": accountCnsEndPoint,
                    "method": "GET"
                })
            });
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
            accountDataBatchResp.responses.forEach((eachAccDtl, index) => {
                if (eachAccDtl?.body?.value) {
                    Samples[index]['account'] = {
                        id: eachAccDtl.body.value.id,
                        name: eachAccDtl.body.value.formattedName,
                        displayId: eachAccDtl.body.value.displayId
                    };
                    console.log("Account response reached. Some values: "+eachAccDtl.body.value.displayId+" "+eachAccDtl.body.value.formattedName);
                }
            })

            /*
            // Get Product details and add to response
            const productApi = await cds.connect.to("Product.Service");
            const requestList = [];

            // forming batch call
            Samples?.forEach((sa, index) => {
              if (!(sa.product && sa.product.productID)) return;
                console.log("Product ID: "+sa.product.productID);
                let productCnsEndPoint = `/sap/c4c/api/v1/product-service/products/${sa.product.productID}?$select=displayId,id,name`;
                requestList.push({
                    "id": 'productCns_' + index++,
                    "url": productCnsEndPoint,
                    "method": "GET"
                })
            });
            const productDataBatchResp = await productApi.send({
                method: "POST",
                path: `$batch`,
                headers: {
                    "Content-Type": "application/json",
                },
                data: {
                    "requests": requestList
                }
            });
            productDataBatchResp.responses.forEach((eachProdDtl, index) => {
                if (eachProdDtl?.body?.value) {
                    Samples[index]['product'] = {
                        id: eachProdDtl.body.value.id,
                        name: eachProdDtl.body.value.name,
                        displayId: eachProdDtl.body.value.displayId

                    };
                    
                }
            })
*/

            return Samples;
        } catch (err) {
            return req.reject("Account and Product are mandatory. "+err);
        }    
   })


/*
  // After create: send REST call to create a new timeline entry
  this.after('CREATE', Samples, async (sample, req) => {
    console.log("After create logic started");

    if (req.target !== Samples) return sample;

    try {
      const timelineApi = await cds.connect.to("Timeline.Service");

      // generate event id and current time
      const eventId = crypto.randomUUID();
      const eventTime = new Date().toISOString();

      // determine account id from sample (try several possible fields)
      const accountId = sample.account.accountID;

      const payload = {
        id: eventId,
        subject: sample.ID,                                  // subject equals the sample ID
        type: "customer.ssc.samplefinalservice.event.SampleCreate",
        specversion: "0.2",
        source: "614cd785fe86ec5c905b4a00",
        time: eventTime,
        datacontenttype: "application/json",
        data: {
          currentImage: {
            ID: sample.ID,
            name: sample.sampleName,
            status: sample.status,
            account: {
              id: accountId
            }
          }
        }
      };

      const resp = await timelineApi.send({
        method: "POST",
        path: "/sap/c4c/api/v1/inbound-data-connector-service/events",
        headers: { "Content-Type": "application/json" },
        data: payload
      });

      console.log(`[Timeline] posted event ${eventId} for sample ${sample.ID} - status=${resp && resp.status ? resp.status : 'unknown'}`);
    } catch (err) {
      console.error('[Timeline] failed to post event for sample', sample && sample.ID, err && (err.stack || err.message || err));
      // do not reject the original create - just log the error
    }

    return sample;
    
  });
*/

// Validate before CREATE (only for root Samples entity)
  this.before('CREATE', Samples, (req) => {
    // ensure this runs only for the Samples root entity
    if (req.target !== Samples) return;

    const d = req.data || {};

    if (d.numberOfSamples != null && d.numberOfSamples <= 0) {
      return req.reject(400, 'Number of Samples must be greater than zero');
    }
   

        // Append "X" to sampleName if dueDate is provided and later than today.
    // If dueDate is not later than today remove trailing "X".
    // (Only modifies sampleName when sampleName is part of the request.)
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