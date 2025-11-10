const cds = require('@sap/cds');
const crypto = require("crypto");
const { SELECT } = cds;

module.exports = cds.service.impl(async function () {

const { Samples } = this.entities;

 // Before Read to expand costOfSample and account safely
    this.before('READ', Samples, (req) => {
        const sel = req.query && req.query.SELECT;
        if (!sel) return; // nothing to change for non-SELECT requests

        // Avoid the problematic "*" expansion that causes PATCH errors
        // Instead, be more specific about what we expand
        const ensureNavExpand = (nav) => {
            if (!sel.columns) sel.columns = [];
            
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
        
        // Only add the problematic "{ ref: ['*'] }" for external GET requests
        if (req._ && req._.odataReq && req._.odataReq.method === 'GET') {
            if (sel.columns.length === 3) { // Only our two expansions
                sel.columns.unshift({ ref: ['*'] }); // Add * at the beginning
            }
        }
    });

    
 // Get Product and Account details on the fly and add to response
    this.after('READ', 'Samples', async (Samples, req) => {
       console.log("After.Read for sample was started");


        // Skip if there are no samples
        if (!Samples || Samples.length === 0) {
            return Samples;
        }

        // Get Product details and add to response
        try {
          /*
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

            return Samples;
        } catch (err) {
            return req.reject("Account and Product are mandatory. "+err);
        }    
   })


});