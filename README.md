# Custom Services - Step by Step

This is a step by step instruction how to create a complete custom services including value selectors and a custom UI.

📺**Video Tutorial**:  You can either follow the steps below or watch the video (18 minutes). 

-> [Video Tutorial - Custom Services](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_gf894byk)

The above video shows very nice all the detailed steps including both the CAP and also the Sales and Service V2 custom services part. This is especially useful for the last configuration steps in the SAP Sales and Service Cloud which are more detailed in the video than elaborated below. 

If you want to see less CAP Development and more on how it looks later for the end-user I can recommend you to watch this more high level [overview video](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_zptgr1j5) for custom services.

*PS: If you are also interessted in some very basics about extensibility you can also check out my [main page](https://github.com/jens-limbach/SSv2-extensibility-workshop) with a guide on mashups and custom code in a cloud function.*

## Table of Contents
- [Pre-requisites](#Pre-requisites)
- [Getting Started](#getting-started)
- [Data Model and Service](#data-model-and-service)
- [Configuration](#configuration)
- [Backend Logic](#backend-logic)
- [Deployment](#deployment)
- [Metadata](#metadata)
- [Business Logic](#business-logic)
- [Timeline Feature](#timeline-feature)
- [ToDos](#ToDos)

## Pre-requisites

- You have a BTP sub-account and access to Cloud Foundry (you can use a free <a href="https://account.hanatrial.ondemand.com/" target="_blank">BTP Trial</a>)
Warning: SAP temporarly disabled cloud foundry deployments on BTP which means you need a proper BTP sub-account at the moment.
- You have setup a Hana Cloud on your BTP Sub-Account (take a look [here](https://github.com/jens-limbach/SSv2-extensibility-workshop/blob/main/hana-setup.md) for the basic steps needed)
- You have setup VSCode and done the initial setup for CAP
- You have enabled the Custom Services feature for creating new entities in your SAP Sales and Service Cloud V2
- You are a little bit familiar with coding or curious enough to get into it :)

Hint: We will be using SAP CAP (Cloud Application Programming Model) for our backend, you can read more about it here: <a href="https://cap.cloud.sap/docs/get-started/" target="_blank">CAP Documentation</a>

## Getting Started

Important: If you try this out with several colleagues on the same BTP, please make sure you replace the suffix "JL" with your initials to make it unique.

1.	Open VSCode and the terminal
2.	Enter in the terminal ```cds init SampleJL```
3.	Enter in the terminal  ```code SampleJL``` (on windows at least this opens the project in visual code :P)

## Data Model and Service

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
## Configuration

6.	Enter in the terminal to add some additional features to our project:
   
```cds add hana```

```cds add xsuaa```

```cds add mta```

```cds add approuter```

7.	Adapt some files manually…

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

8. Let's test it! We are done creating our model, our service, defining authentication and defining our database. Before we continue to make more adjustments and add some business logic, let us test our new backend locally.

- First make sure all packages are up to date using the command:
```npm update```

- Then start your web server locally:
```cds watch```

- If you follow the given link in the terminal you will be re-directed to a website running locally. When you click on the service endpoint for the samples you will see the result of a GET request. Currently we have no data thats why it looks quite empty.
<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/e44362235393c3c60460ee9e5d3f20be74af2cdc/images/cds%20server%20preview.png">

If you want you can send with any tool as POST request to the same endpoint:
<a href="http://localhost:4004/sample-service/Sample" target="_blank">http://localhost:4004/sample-service/Sample</a>

You can use for the first test a very simple payload like:
```
{
            "sampleName": "Postman Sample JL",
            "hazardous": true,
            "hazardousReason": "Some reason",
            "numberOfSamples": 5
}
```

9. We need to adjust a few more files. Adjust the ```app/router/xs-app.json``` by adding CORS exceptions (for your tenant) and adjust authMethod=none -> Snippet 4 and 5

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

10. Adapt the ```mta.yaml``` by changing the generated hana db name according to your own DB name (3 places in i.e. to “name: customservice-basic-db”) and also add in each parameters section a limitation for the reservered memory and disk space (this will help to not rapidly block your dev space).

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/2bafe55a3a0705af6d20373558da1dce293f782a/images/mta-yaml.png">

-> In case your BTP subaccount has spaces in it’s name: adjust the ```xsappname: SampleJL``` in your ```mta.yaml``` by removing the generated placeholders for subaccount and space.

-> Add 256M memory to all your services in ```mta.yaml``` to save some dev space
```
      disk-quota: 256M
      memory: 256M
```

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/66fec41aff37011bd395f9b8e591f4cd2178e029/images/ReduceMemory.png">

## Backend Logic

11. Create a ```sample-service.js``` file and add the following logic to it. This logic ensures the response is well formatted for our purpose.

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

12. Add to your ```package.json``` the below directly into the cds production section. We need to add some credentials. You need to replace your tenant and credentials in the below code. Normally you would use BTP destinations here but this way we "save" a step.

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
## Deployment

13.	Enter in your terminal

```npm install @sap-cloud-sdk/http-client @sap-cloud-sdk/resilience -save```

```npm update --package-lock-only```

```mbt build```

```cf login```

```cf deploy mta_file```

14.	Copy the app router url and try out your backend service.

## Metadata

15.	Enter in the terminal ```cds -2 json .\srv\Sample-service.cds > BackendService.json``` and copy the json into a new file.

16.	Create a new custom service entity in the Sales and Service Cloud V2 frontend, convert the CAP json file, download the final json definition 

17. Instead of adjusting the metadata we directly download it here: [Latest Metadata file](https://github.com/jens-limbach/SSv2-custom-sample-object/blob/main/LatestMetadata.json). Normally you would need to edit the downloaded metadata file a bit and make the some adjustments like the ones below. But most of these will disappear soon as the CAP conversion is currently undergoing a huge improvement. Here are some improvements that might be necessary.
-   Add a unique object type code ```"objectTypeCode": "CUS1329",``` on your entity level 
-   Add a label on the top entity level ```"label": "Samples",```
-   Make sure that your name on service definition level (very top) is unique in your tenant ```"name": "SampleV3",```
-   Replace all ```"dataType": "COMPOSITION",``` with ```"dataType": "OBJECT",```
-   Add a notes api manually
-   Map all value selectors (OVS) correctly:

For Account:
1. Remove the generated "ID" field (which only holds the CAP internal ID)
2. Add to the accountID field the following attributes:
```
              "descriptionAttribute": "name",
              "keyType": "FOREIGN",
```
3. Change the following attributes of the accountID to true:
```
              "creatable": true,
              "updatable": true,
```
4. Complete the objectReference section of the accountID like given below:
```
"objectReference": {
    "targetAttribute": "id",
    "targetEntity": "sap.ssc.md.accountservice.entity.account",
    "keyGroup": "account",
    "targetService": "sap.ssc.md.service.accountService"
  }
```

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/95f671852d3c2814a7ea23d5eddad70371a0cbae/images/MakeOVSwork2.png">

For the other value selectors you must do it the same way. Please see below all object References needed in this example:

For Product
```
"objectReference": {
      "targetAttribute": "id",
      "targetEntity": "sap.ssc.md.productservice.entity.product",
      "keyGroup": "product",
      "targetService": "sap.ssc.md.service.productService"
}
```

For Employee
```
"objectReference": {
    "targetAttribute": "id",
    "targetEntity": "sap.ssc.md.employeeservice.entity.employee",
    "keyGroup": "employee",
    "targetService": "sap.ssc.md.service.employeeService"
}
```

For Opportunity
```
not yet supported - coming soon
```

For Case
```
not yet supported - coming soon
```

-   Adjust the currency code to the V2 services
```"targetAttribute": "code",
    "targetEntity": "sap.ssc.i18nservice.entity.currency",
    "targetService": "sap.ssc.service.i18nService"
```

-   Make the notes "creatable" and "updatable", remove admin fields and add manually the API for the sub-structure "Notes" in the api section directly after the "Samples" API definition

Change your "note" field on your notes structure to creatable and updatable : true
```
              "creatable": true,
              "updatable": true,
```

Remove all administrative fields from the metadata (createdBy, updatedBy, modifiedAt, createdAt, Sample_ID) because they are only calculated by the backend. After that your notes array should look very simple like this (be carefull not to change the business entity but only the array which is part of the Samples entity):
```
{
          "name": "notes",
          "label": "notes",
          "dataType": "ARRAY",
          "itemDataType": "OBJECT",
          "nullable": true,
          "creatable": true,
          "updatable": true,
          "filterable": false,
          "searchable": false,
          "sortable": false,
          "entityReference": "Notes",
          "objectDefinition": [
            {
              "name": "note",
              "dataType": "STRING",
              "dataFormat": "STRING",
              "creatable": true,
              "updatable": true,
              "nullable": true,
              "sortable": false,
              "filterable": false,
              "label": "notes note"
            }
          ]
        }
```

Add the needed API part:
```
{
      "name": "NotesApiCAP",
      "description": "API for interacting with BTP Notes service",
      "title": "BTP Notes API",
      "apiPath": "/sample-service/Samples/{id}/notes",
      "entityReference": "Notes",
      "operations": [
        {
          "id": "readNotes",
          "path": "/",
          "method": "READ",
          "request": {
            "pathVariables": [
              { "name": "id", "dataType": "STRING", "dataFormat": "UUID" }
            ]
          },
          "responses": [
            { "description": "200 OK", "responseCode": "200" },
            { "description": "400 BAD_REQUEST", "responseCode": "400" },
            { "description": "401 UNAUTHORIZED", "responseCode": "401" },
            { "description": "403 FORBIDDEN", "responseCode": "403" },
            { "description": "404 NOT_FOUND", "responseCode": "404" },
            {
              "description": "500 INTERNAL_SERVER_ERROR",
              "responseCode": "500"
            }
          ]
        },
        {
          "id": "readNote",
          "path": "/{noteID}",
          "method": "READ",
          "request": {
            "pathVariables": [
              { "name": "noteID", "dataType": "STRING", "dataFormat": "UUID" }
            ]
          },
          "responses": [
            { "description": "200 OK", "responseCode": "200" },
            { "description": "400 BAD_REQUEST", "responseCode": "400" },
            { "description": "401 UNAUTHORIZED", "responseCode": "401" },
            { "description": "403 FORBIDDEN", "responseCode": "403" },
            { "description": "404 NOT_FOUND", "responseCode": "404" },
            {
              "description": "500 INTERNAL_SERVER_ERROR",
              "responseCode": "500"
            }
          ]
        },
        {
          "id": "createNote",
          "path": "/",
          "method": "POST",
          "request": { "pathVariables": [] },
          "responses": [
            { "description": "201 Created", "responseCode": "201" },
            { "description": "400 BAD_REQUEST", "responseCode": "400" },
            { "description": "401 UNAUTHORIZED", "responseCode": "401" },
            { "description": "403 FORBIDDEN", "responseCode": "403" },
            {
              "description": "500 INTERNAL_SERVER_ERROR",
              "responseCode": "500"
            }
          ]
        },
        {
          "id": "updateNote",
          "path": "/{noteID}",
          "method": "PATCH",
          "request": {
            "pathVariables": [
              { "name": "noteID", "dataType": "STRING", "dataFormat": "UUID" }
            ]
          },
          "responses": [
            { "description": "200 OK", "responseCode": "200" },
            { "description": "400 BAD_REQUEST", "responseCode": "400" },
            { "description": "401 UNAUTHORIZED", "responseCode": "401" },
            { "description": "403 FORBIDDEN", "responseCode": "403" },
            { "description": "404 NOT_FOUND", "responseCode": "404" },
            {
              "description": "500 INTERNAL_SERVER_ERROR",
              "responseCode": "500"
            }
          ]
        },
        {
          "id": "deleteNote",
          "path": "/{noteID}",
          "method": "DELETE",
          "request": {
            "pathVariables": [
              { "name": "noteID", "dataType": "STRING", "dataFormat": "UUID" }
            ]
          },
          "responses": [
            { "description": "200 OK", "responseCode": "200" },
            { "description": "400 BAD_REQUEST", "responseCode": "400" },
            { "description": "401 UNAUTHORIZED", "responseCode": "401" },
            { "description": "403 FORBIDDEN", "responseCode": "403" },
            { "description": "404 NOT_FOUND", "responseCode": "404" },
            {
              "description": "500 INTERNAL_SERVER_ERROR",
              "responseCode": "500"
            }
          ]
        }
      ]
    }
```

18. Upload the adjusted metadata file in custom services
    
19.	Add UI’s to your custom service and add your deployed backend as the Host
    
20.	Assign it to your user via a business role
    
21.	Test!
    
22.	After this is working we can start to build the custom UI on top of our running backend service!

Now after this we have some additional steps to further enhance your custom service.

## Business Logic

23. Validation: Let's add a simple validation to the sample request on create. We want to check that the "number of samples" cannot be 0.
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

24. Determination: Let's also add a simple determination during every create which is appending a red dot at the sample name if the sample is overdue. (this logic would better be also happening during every update)
```
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
```

## Timeline Feature

25. Bonus: Enable the timeline feature. There several configuratoin steps involved which your "trainer" will show you. After that add the below code to your service. Note: This code still must be reviewed.

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
## Todos

Planned Todo's for this Tutorial:
- End to End Video
- Finalize the timeline feature
- Review all the nodeJS code
- Add the related entity and document flow topics
- Add a service for "custom key metrics"
- Add example for multiple error messages including warnings and info messages
- Add an example of a custom UI to this tutorial
- Add more explanations around the connections in package.json and the cloud sdk
- Link documentation (custom services, metadata guidelines etc.)