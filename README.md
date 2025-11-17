# Custom Services - Step by Step

This is a step by step instruction how to create an already more complete custom services including value selectors and a custom UI.

📺**Video Tutorial**: This video is based on a different custom object but it gives you all the steps you need to do.

-> [Video Tutorial - Custom Services](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_5r2suzns)

The above video shows very nice all the detailed steps including both the CAP and also the Sales and Service V2 custom services part.

If you want to see less CAP Development and more on how it looks later for the end-user I can recommend you to watch this more high level [overview video](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_zptgr1j5) for custom services.

*PS: If you are also interessted in some very basics about extensibility you can also check out my [main page](https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/main) with a guide on mashups and custom code in a cloud function.*

**Pre-requisites:**

- You have a BTP sub-account and access to Cloud Foundry (you can use a free <a href="https://account.hanatrial.ondemand.com/" target="_blank">BTP Trial</a>)
- You have setup a Hana Cloud on your BTP Sub-Account (take a look [here](https://github.com/jens-limbach/SSv2-extensibility-workshop/blob/main/hana-setup.md) for the basic steps needed)
- You have setup VSCode and done the initial setup for CAP
- You have enabled the Custom Services feature for creating new entities in your SAP Sales and Service Cloud V2
- You are a little bit familiar with coding or curious enough to get into it :)

Hint: We will be using SAP CAP (Cloud Application Programming Model) for our backend, you can read more about it here: <a href="https://cap.cloud.sap/docs/get-started//" target="_blank">CAP Documentation</a>

**Step by Step Guide:**

Important: If you try this out with several colleagues on the same BTP, please make sure you replace the suffix "JL" with your initials to make it unique.

1.	Open VSCode and the terminal
2.	Enter in the terminal ```cds init SampleJL```
3.	Enter in the terminal  ```code SampleJL``` (on windows at least this opens the project in visual code :P)
4.	Create ```schema.cds``` file with your entity in the db folder -> Snippet 1

Snippet 1:
```
namespace sap.capire.customservice;

using {managed} from '@sap/cds/common';

entity Samples : managed {
    key ID                : UUID;
        @description
        sampleName        : String(255); // Sample Name: Text
        sampleType        : SampleCodeType;
        numberOfSamples   : Integer; // Number of Samples: Number
        shipToAddress     : String(255); // Ship to Address: Address (structured type)
        @dataFormat: 'AMOUNT'
        costOfSample      : Composition of Amount; // Cost of Sample: Currency
        hazardous         : Boolean; // Hazardous: Boolean
        hazardousReason   : String(1000); // Hazardous Reason: Text-Long (1000 Chars)
        @dataFormat: 'DATE'
        dueDate           : Date; // Due Date: Date
        overdueStatusIcon : String(255); // Overdue Status: String to hold emoticon
        status            : StatusCodeType default 'OPEN'; // Status: Select List
        // Only relevant if sampleType = withPackaging
        PackagingHeight   : Decimal(15, 2); // Packagin Height
        PackagingWidth    : Decimal(15, 2); // Packaging Width
        PackagingMaterial : PackagingCodeType;

        // Associations to other entities
        productUUID       : UUID;
        product           : Composition of Products
                                on product.ID = productUUID; // Product: Relation (Part Number)

        accountUUID      : UUID;
        account           : Composition of Account
                                on account.ID = accountUUID; // just a simple UUID is needed because it is foreign key scenario

        employeeUUID      : UUID;
        employee          : Association to Employee
                                on employee.employeeID = employeeUUID; // Employee: Relation (Employee)

        opportunityUUID   : UUID;
        opportunity       : Association to Opportunities // Opportunity: Relation (Opportunity)
                                on opportunity.opportunityID = opportunityUUID;

        serviceCaseUUID   : UUID;
        serviceCase       : Association to ServiceCases // Service Case: Relation (Service Case)
                                on serviceCase.caseID = serviceCaseUUID;

        // Composition: sub-entity Notes (one or many as needed)
        notes             : Composition of many Notes
                                on notes.sample = $self; // Composition of Notes

}

// Structured data type for Amount
@isCnsEntity: true
entity Amount {
    key ID           : UUID;
        currencyCode : String;
        content      : Decimal(10, 2);
}

// Enum types

type StatusCodeType : String @assert.range enum {
    OPEN        = 'OPEN';
    INPROGRESS  = 'INPROGRESS';  
    DELIVERED   = 'DELIVERED';
    RETURNED    = 'RETURNED';
    OVERDUE     = 'OVERDUE';
}

type PackagingCodeType : String @assert.range enum {
    PLASTIC    = 'PLASTIC';
    METAL  = 'METAL';
    OTHERMATERIAL    = 'OTHERMATERIAL';
}

type SampleCodeType : String @assert.range enum {
    WITHPACKAGING    = 'WITHPACKAGING';
    WITHOUTPACKAGING = 'WITHOUTPACKAGING';
}
            
            

// New Notes sub-entity used as composition from Samples
entity Notes : managed {
    key notesID : UUID;
        note    : String(1000);
        sample  : Association to Samples; // association back to parent used by the ON-condition
}

// Associated CRM entities

@isCnsEntity: true
entity Products {
    key ID        : UUID;
        productID : UUID;
        displayId : String;
        @description name      : String(255);
}

@isCnsEntity: true
entity Account {
    key ID : UUID;
        accountID : UUID;
        displayId : String;
        @description name      : String(255);
}

@isCnsEntity: true
entity Opportunities {
    key opportunityID : UUID;
}

@isCnsEntity: true
entity ServiceCases {
    key caseID : UUID;
}

@isCnsEntity: true
entity Employee {
    key employeeID : UUID;
}
```

5.	Create ```sample-service.cds``` file in the srv folder with your service definition -> Snippet 2

Snippet 2:
```
using {sap.capire.customservice as sampleschema} from '../db/schema';

service SampleService @(path: '/sample-service') {

    // Projections so that we have those endpoints ready for our frontend application
    @odata.draft.bypass
    entity Samples as projection on sampleschema.Samples excluding { createdAt, createdBy, modifiedBy };
    entity Notes        as projection on sampleschema.Notes excluding { createdAt, createdBy, modifiedBy };

    // Event for the Timeline Entry
    event customer.ssc.sampleservice.event.SampleCreate {};
}
```

6.	Enter in the terminal to add some additional features to our project:
   
```cds add hana```

```cds add xsuaa```

```cds add mta```

```cds add approuter```

9.	Adapt some files manually…

-> Adjust the ```package.json``` (overwrite the cds section by changing auth to mocked and adding the hana db) -> Snippet 3

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/2bafe55a3a0705af6d20373558da1dce293f782a/images/package-json.png">
 
Snippet 3:
```
"cds": {
    "requires": {
      "[production]": {
      "db": "hana",
      "auth": "mocked"
      },
      "auth": "mocked"
    }
  }
```

-> Adjust the ```app/router/xs-app.json``` by adding CORS exceptions (for your tenant) and adjust authMethod=none -> Snippet 4 and 5

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/2bafe55a3a0705af6d20373558da1dce293f782a/images/xs-app-json.png">
 
Snippet 4:
```
  "authenticationMethod": "none",
```

Snippet 5:

```
,
  "cors": [
    {
      "uriPattern": "(.*)",
      "allowedMethods": [
        "GET",
        "POST",
        "OPTIONS",
        "PATCH",
        "PUT",
        "DELETE"
      ],
      "allowedOrigin": [
        {
          "host": "localhost",
          "protocol": "http",
          "port": 5000
        },
        {
          "host": "localhost",
          "protocol": "http",
          "port": 4100
        },
        {
          "host": "localhost",
          "protocol": "http",
          "port": 4200
        },
        {
          "host": "YOURTENANT.de1.demo.crm.cloud.sap",
          "protocol": "https"
        }
      ],
      "allowedHeaders": [
        "Accept",
        "Authorization",
        "Content-Type",
        "Access-Control-Allow-Credentials",
        "sap-c4c-rawagent",
        "X-Csrf-Token",
        "If-Match"
      ],
      "exposeHeaders": [
        "Etag",
        "X-Csrf-Token"
      ],
      "allowedCredentials": true
    }
  ]
```

-> Adapt the ```mta.yaml``` by changing the generated hana db name according to your own DB name (3 places in i.e. to “name: customservice-basic-db”) and also add in each parameters section a limitation for the reservered memory and disk space (this will help to not rapidly block your dev space).

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/2bafe55a3a0705af6d20373558da1dce293f782a/images/mta-yaml.png">

-> In case your BTP subaccount has spaces in it’s name: adjust the ```xsappname: SampleJL``` in your ```mta.yaml``` by removing the generated placeholders for subaccount and space.

-> Add 256M memory to all your services in ```mta.yaml``` to save some dev space
```
      disk-quota: 256M
      memory: 256M
```

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/66fec41aff37011bd395f9b8e591f4cd2178e029/images/ReduceMemory.png">

7. We are done now creating our model, our service and the link to our database. Before we continue to add some business logic, let us test our application.

- First make sure all packages are up to date using the command:
```npm update --package-lock-only```

- Then start your web server locally:
```cds watch```

- Now follow the given links to and try to access your backend via a "GET" and a "POST" request:

[GET request to local](http://localhost:4004/sample-service/Sample)

7. Create a ```sample-service.js``` file and add the following logic to it. This logic ensures the response is well formatted for our purpose.

Snippet:
```
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


});
```

8. Add to your ```package.json``` the below directly into the cds production section. We need to add some credentials. You need to replace your tenant and credentials in the below code. Normally you would use BTP destinations here but this way we "save" a step.

After exactly the last curly bracket here:
```
  "cds": {
    "requires": {
      "[production]": {
        "db": "hana",
        "auth": "mocked"
      }
```
You must add that here and overwrite all the curly brackets at the end:
```
,
      "auth": "mocked",
      "Account.Service": {
        "kind": "rest",
        "[production]": {
          "credentials": {
            "url": "https://YOURTENANT.de1.demo.crm.cloud.sap",
            "username": "Dev",
            "password": "Welcome1!"
          }
        },
        "[development]": {
          "credentials": {
            "url": "https://YOURTENANT.de1.demo.crm.cloud.sap",
            "username": "Dev",
            "password": "Welcome1!"
          }
        }
      },
      "Product.Service": {
        "kind": "rest",
        "[production]": {
          "credentials": {
            "url": "https://YOURTENANT.de1.demo.crm.cloud.sap",
            "username": "Dev",
            "password": "Welcome1!"
          }
        },
        "[development]": {
          "credentials": {
            "url": "https://YOURTENANT.de1.demo.crm.cloud.sap",
            "username": "Dev",
            "password": "Welcome1!"
          }
        }
      },
      "Timeline.Service": {
        "kind": "rest",
        "[production]": {
          "credentials": {
            "url": "https://YOURTENANT.de1.demo.crm.cloud.sap",
            "username": "INBOUNDSAMPLE",
            "password": "WelCome123!$%WeLcoMe1!123$%&/t"
          }
        },
        "[development]": {
          "credentials": {
            "url": "https://YOURTENANT.de1.demo.crm.cloud.sap",
            "username": "INBOUNDSAMPLE",
            "password": "WelCome123!$%WeLcoMe1!123$%&/t"
          }
        }
      }
    }
  }
}
```

8.	Enter in your terminal

```npm install @sap-cloud-sdk/http-client @sap-cloud-sdk/resilience -save```

```npm update --package-lock-only```

```mbt build```

```cf login```

```cf deploy mta_file```

10.	Copy the app router url and try out your backend service.
    
12.	Enter in the terminal ```cds -2 json .\srv\Sample-service.cds > BackendService.json``` and copy the json into a new file.

13.	Create a new custom service entity in the Sales and Service Cloud V2 frontend, convert the CAP json file, download the final json definition 

14. Instead of adjusting the metadata we directly download it here: [Latest Metadata file](https://github.com/jens-limbach/SSv2-custom-sample-object/blob/main/LatestMetadata.json). Normally you would need to edit the downloaded metadata file a bit and make the some adjustments like the ones below. But most of these will disappear soon as the CAP conversion is currently undergoing a huge improvement. Here are some improvements that might be necessary.
-   Add a unique object type code ```"objectTypeCode": "CUS1329",``` on your entity level
-   If you cannot "edit" your objects, the attribute ```"description": true,``` might be missing on your "sampleName" field
-   If you cannot see your object in the timeline configuration, check if there is a label on the top entity level ```"label": "Samples",```
-   Also for the timeline makes sure there is an event defined and it has the correct entity reference ```"entityReference": "Samples",```
-   If you have boolean values you must remove the the data formats from the ```"dataType": "BOOLEAN",```
-   Add in the notes sections you must remove the additional "itemDataType"
```
"dataType": "ARRAY",
"itemDataType": "OBJECT",
```
-   Check if all the enum values are generated correctly
-   Add a notes entity and api (if not generated automatically)
-   Remove the generated sample sub-structure in notes (which is currently generated because of the "back referencing")
-   Map all value selectors correctly
-   Adjust the currency code to the V2 services
```"targetAttribute": "code",
    "targetEntity": "sap.ssc.i18nservice.entity.currency",
    "targetService": "sap.ssc.service.i18nService"
```

15. upload the adjusted metadata file in custom services
    
16.	Add UI’s to your custom service
    
17.	Assign it to your user via a business role
    
18.	Test!
    
19.	After this is working we can start to build the custom UI on top of our running backend service!

Now after this we have some additional steps to further enhance your custom service.

20. Validation: Let's add a simple validation to the sample request on create. We want to check that the "number of samples" cannot be 0.
```
// Validate before CREATE (only for root Samples entity)
  this.before('CREATE', Samples, (req) => {
    // ensure this runs only for the Samples root entity
    if (req.target !== Samples) return;

    const d = req.data || {};

    if (d.numberOfSamples != null && d.numberOfSamples <= 0) {
      return req.reject(400, 'Number of Samples must be greater than zero');
    }
   
    });

```

21. Determination: Let's also add a simple determination during every update which is appending a red dot at the sample name if the sample is overdue and also sets the status from open to overdue.
```
// Validate before UPDATE (only for root Samples entity)
  this.before('UPDATE', Samples, async (req) => {
    if (req.target !== Samples) return;

    const d = req.data || {};

    
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
        if (d.status === 'Open') {
          d.status = 'Overdue';
        }
      } else if (due >= today && d.sampleName.endsWith(' 🔴')) {
        d.sampleName = d.sampleName.slice(0, -2);
      }
    }

  });

```

22. Bonus: Enable the timeline feature. There several configuratoin steps involved which your "trainer" will show you. After that add the below code to your service. Note: This code still must be reviewed.

```
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
```

Planned Todo's for this Tutorial:
- End to End Video
- add npm update in the beginning following an cds watch to show how easy you can test your backend locally
- Finalize the timeline feature
- Finalize the "perfect" schema (i.e. rework the associations)
- Review all the nodeJS code
- Add the related entity and document flow topics
- Add a service for "custom key metrics"
- Add example for multiple error messages including warnings and info messages
- Add an example of a custom UI to this tutorial
- Add more explanations around the connections in package.json and the cloud sdk
- Link documentation (custom services, metadata guidelines etc.)