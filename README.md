# Custom Services - Step by Step

This is a step by step instruction how to create a complete custom services including value selectors and a custom UI.

📺**Video Tutorial**:  You can either follow the steps below or watch the video (18 minutes). 

-> [Video Tutorial - Custom Services](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_gf894byk)

The above video shows very nice all the detailed steps including both the CAP and also the Sales and Service V2 custom services part. This is especially useful for the last configuration steps in the SAP Sales and Service Cloud which are more detailed in the video than elaborated below. 

If you want to see less CAP Development and more on how it looks later for the end-user I can recommend you to watch this more high level [overview video](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_zptgr1j5) for custom services.

*PS: If you are also interessted in some very basics about side-by-side extensibility you can also check out my [beginners extensibility workshop](https://github.com/jens-limbach/SSv2-extensibility-workshop) with a guide on mashups and custom code in a cloud function.*

## Table of Contents
- [Pre-requisites](#Pre-requisites)
- [Business Scenario](#business-scenario)
- [Getting Started](#getting-started)
- [Data Model and Service](#data-model-and-service)
- [Configuration](#configuration)
- [Backend Logic](#backend-logic)
- [Deployment](#deployment)
- [Metadata](#metadata)
- [UI Generation and Testing](#ui-generation-and-testing)
- [Business Logic](#business-logic)
- [Timeline Feature](#timeline-feature)
- [Related Entities Feature](#related-entities-feature)
- [Custom Frontend build with AI](#custom-frontend-build-with-ai)
- [Documentation](#documentation)
- [Extensions - Wanna Know More?](#-extensions---wanna-know-more)
- [ToDos](#ToDos)

## Pre-requisites

- You have a BTP sub-account and access to Cloud Foundry.
*Warning: SAP temporarly disabled cloud foundry deployments on <a href="https://account.hanatrial.ondemand.com/" target="_blank">BTP Trials</a> which means you need a proper BTP sub-account at the moment.*
- You have setup a Hana Cloud on your BTP Sub-Account (take a look [here](https://github.com/jens-limbach/SSv2-extensibility-workshop/blob/main/hana-setup.md) for the basic steps needed)
- You have installed VSCode and done the <a href="https://cap.cloud.sap/docs/get-started/#prerequisites" target="_blank">initial setup for CAP</a> (Node.js installed and cds tool kit installed via ```npm add -g @sap/cds-dk```)
- You have access to the Custom Services feature for creating new entities in your SAP Sales and Service Cloud V2
- You are a little bit familiar with coding or curious enough to get into it :)

*Hint 1:* We will be using SAP CAP (Cloud Application Programming Model) for our backend, you can read more about it here: <a href="https://cap.cloud.sap/docs/get-started/" target="_blank">CAP Documentation</a>

*Hint 2:* If you are already an expert, you can also just clone my entire repository locally and skip most of the steps but I recommend everyone to build the project step by step to understand what is happening. If you clone it, you need to re-name the ```package.json.example``` to just ```package.json``` and insert your own credentials and you also need to adjust some of the other parameters from below (like db name, CORS whitelisting etc.).

## Business Scenario

The business scenario which this extension example is designed evolves around a sample process. Many companies send out samples before they make a large contract. In our case we want to have a "sample object" which helps us to cover all related data around a sample including the link to standard master entities like a product, account or employee. But also transactional entities like having samples as part of an opportunty or maybe opening a service case linked to a faulty sample. It is a good example to explain the key features around custom services. Just in reality, I would try to solve a "sample process" with a "sample order" follow-up as much in standard as possible. ;)

At the end of the tutorial you will have a comprehensive custom object, with a fully generated UI, authorization features, seamless embedded in the standard application, stored in a hana db (or any db of your choice) and a powerful backend where you can place any custom code you need in whatever programming language you want to use. In our example we use NodeJS and SAP CAP (Cloud Application Programming Model) for that backend.

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/392753605ea2c1c0a94445b8a5d9669e94aeb0b7/images/FinishedSample.png">

## Getting Started

*Important:* If you try this out with several colleagues on the same BTP, please make sure you replace the suffix "JL" with your initials to make it unique.

But now let's really get started to create your project!

1.	Open your VSCode and the terminal
2.	Enter in the terminal ```cds init SampleJL``` to initialize your CAP project
3.	Enter in the terminal  ```code SampleJL``` to open your project (on windows at least this opens the project in visual code :P). You can also just open the folder with VSCode.

## Data Model and Service

4.	Create ```schema.cds``` file with your entity in the ```db``` folder -> Snippet 1

Snippet 1:
```
namespace sap.capire.customservice;

using {managed} from '@sap/cds/common';

@isRootEntity : true
entity Sample : managed {
    key id                : UUID;

        @description
        sampleName        : String(255); // Descrptive name of the sample
        sampleType        : SampleCodeType; // Sample Type: Select List

        @dataFormat: 'QUANTITY'
        numberOfSamples   : Composition of one Quantity; // Number of Samples
        shipToAddress     : String(255); // Ship to Address

        @dataFormat: 'AMOUNT'
        costOfSample      : Composition of one Amount; // Cost of Sample: Currency
        hazardous         : Boolean; // Hazardous: Boolean
        hazardousReason   : String(1000); // Hazardous Reason: Text-Long (1000 Chars)

        @dataFormat: 'DATE'
        dueDate           : Date; // Due Date: Date
        overdueStatusIcon : String(255); // Overdue Status: String to hold emoticon
        status            : StatusCodeType default 'OPEN'; // Status: Select List

        packagingHeight   : Decimal(15, 2); // Packaging Height
        packagingWidth    : Decimal(15, 2); // Packaging Width
        packagingMaterial : PackagingCodeType; // Packaging Material: Select List

        // Associations to other entities
        product           : Composition of one Product;
        account           : Composition of one Account;
        employee          : Composition of one Employee;
        opportunity       : Composition of one Opportunity;
        serviceCase       : Composition of one ServiceCase;
        notes             : Composition of many Note on notes.sampleId = id;
}

// Structured data type for Amount and Quantity
@isCnsEntity: true
entity Amount {
    key id           : UUID;
        currencyCode : String;
        content      : Decimal(10, 2);
}

@isCnsEntity: true
entity Quantity {
    key id        : UUID;
    content       : Integer;
    uomCode       : String; // Unit of Measure Code
}

// Enum types
type StatusCodeType    : String @assert.range enum {
    OPEN = 'OPEN';
    INPROGRESS = 'INPROGRESS';
    DELIVERED = 'DELIVERED';
    RETURNED = 'RETURNED';
    OVERDUE = 'OVERDUE';
}

type PackagingCodeType : String @assert.range enum {
    PLASTIC = 'PLASTIC';
    METAL = 'METAL';
    OTHERMATERIAL = 'OTHERMATERIAL';
}

type SampleCodeType    : String @assert.range enum {
    WITHPACKAGING = 'WITHPACKAGING';
    WITHOUTPACKAGING = 'WITHOUTPACKAGING';
}

// New Notes sub-entity
entity Note : managed {
    key id       : UUID;
        note     : String(1000);
        sampleId : UUID;  // Foreign key to Sample
}

// Associated CRM entities

@isCnsEntity: true
entity Product {
    key id                : UUID;
        productId         : UUID;
        displayId         : String;
        @description name : String(255);
}

@isCnsEntity: true
entity Account {
    key id                : UUID;
        accountId         : UUID;
        displayId         : String;
        @description name : String(255);
}

@isCnsEntity: true
entity Opportunity {
    key id                : UUID;
        opportunityId     : UUID;
        displayId         : String;
        @description name : String(255);
}

@isCnsEntity: true
entity ServiceCase {
    key id                : UUID;
        serviceCaseId     : UUID;
        displayId         : String;
        @description name : String(255);
}

@isCnsEntity: true
entity Employee {
    key id                : UUID;
        employeeId        : UUID;
        displayId         : String;
        @description name : String(255);
}
```

5.	Create ```sample-service.cds``` file in the ```srv``` folder with your service definition -> Snippet 2

Snippet 2:
```
using {sap.capire.customservice as sampleschema} from '../db/schema';

service SampleService @(path: '/sample-service') {

    // Projections so that we have those endpoints ready for our frontend application
    @odata.draft.bypass
    entity Samples      as projection on sampleschema.Sample;
    entity Notes        as projection on sampleschema.Note;

    // Events for Timeline and Autoflow in SAP Sales and Service Cloud V2
    event SampleCreate {};
    event SampleUpdate {};
    event SampleDelete {};
}
```
## Configuration

6.	Open the terminal and use the following commands to add some additional features to our project:
   
```cds add hana```

```cds add xsuaa```

```cds add mta```

```cds add approuter```

7.	Now we need to adapt some files manually.

-> Adjust the ```package.json``` (replace the entire cds section by changing auth to mocked and adding the hana db) -> Snippet 3

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

- The terminal will provide you a link to your localhost. If you follow the given link you will be re-directed to a website running locally. When you click on the service endpoint for the samples you will see the result of a GET request. Currently we have no data thats why it looks quite empty.
<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/e44362235393c3c60460ee9e5d3f20be74af2cdc/images/cds%20server%20preview.png">

If you want you can also send with any tool  POST request to the same endpoint and try out how it feels to create new samples in your local database via your newly created backend. This is the endpoint of your "local" backend: <a href="http://localhost:4004/sample-service/Sample" target="_blank">http://localhost:4004/sample-service/Sample</a>

You can use for the first test a very simple payload like:
```
{
            "sampleName": "Postman Sample JL",
            "hazardous": true,
            "hazardousReason": "Some reason",
            "shipToAddress": "some address"
}
```

If you do another GET after that POST you will see that data is stored in your local backend.

9. Before we deploy  we need to adjust a few more configuration files. Adjust the ```app/router/xs-app.json``` by adding CORS exceptions (for your tenant) and specify that we do not use authentication for now. Don't forget to replace ```YOURTENANT.de1.demo.crm.cloud.sap``` with your own tenant -> Snippet 4 and 5

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

-> In case your BTP subaccount has "spaces" in it’s name my recommendation is to adjust the ```xsappname: SampleJL``` in your ```mta.yaml``` by removing the generated placeholders for subaccount and space as weird subaccount names can lead to issues.

-> Add 256M memory to all your services in ```mta.yaml``` to save some dev space
```
      disk-quota: 256M
      memory: 256M
```

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/66fec41aff37011bd395f9b8e591f4cd2178e029/images/ReduceMemory.png">

## Backend Logic

11. Create a ```sample-service.js``` file and add the following logic to it. This logic ensures the response is well formatted for our purpose and that we fetch live the display names and ID's of our linked "standard objects" account, product and employee.

Snippet:
```
const cds = require("@sap/cds");
const crypto = require("crypto");
const { SELECT } = cds;

module.exports = cds.service.impl(async function () {
  const { Samples } = this.entities;

  // Before READ
  // Expands all structural properties (like account, product, employee, costOfSample, etc.) 
  // Specifically defines which fields to select for response payload
  this.before("READ", Samples, (req) => {
    const sel = req.query && req.query.SELECT;
    if (!sel) return; // nothing to change for non-SELECT requests

    console.log("=== BEFORE READ DEBUG ===");

    // Initialize columns if not present
    if (!sel.columns) sel.columns = [];

    const scalarFields = [
      "id",
      "createdAt",
      "createdBy",
      "modifiedAt",
      "modifiedBy",
      "sampleName",
      "sampleType",
      "shipToAddress",
      "hazardous",
      "hazardousReason",
      "dueDate",
      "overdueStatusIcon",
      "status",
      "packagingHeight",
      "packagingWidth",
      "packagingMaterial",
    ];

    // Add scalar fields if they don't exist
    scalarFields.forEach((field) => {
      const exists = sel.columns.some(
        (col) => col && col.ref && col.ref[0] === field
      );
      if (!exists) {
        sel.columns.push({ ref: [field] });
      }
    });

    // Add navigation expansions
    const ensureNavExpand = (nav) => {
      const exists = sel.columns.some((col) => {
        return col && col.ref && Array.isArray(col.ref) && col.ref[0] === nav;
      });
      if (!exists) {
        sel.columns.push({ ref: [nav], expand: ["*"] });
      }
    };

    // Always ensure these specific expansions are available for after('READ') logic
    ensureNavExpand("costOfSample");
    ensureNavExpand("account");
    ensureNavExpand("numberOfSamples");
    ensureNavExpand("product");
    ensureNavExpand("employee");
    ensureNavExpand("opportunity");
    ensureNavExpand("serviceCase");

    console.log(
      "Columns after modification:",
      sel.columns.map((col) => col.ref)
    );
  });

  // After UPDATE (PATCH)
  // Returns complete entity with all fields and enriched data (for account, product, employee)
  this.after("UPDATE", Samples, async (result, req) => {
    console.log("🔥 after(UPDATE) handler triggered!");

    if (!result || !result.id) {
      console.log("No result or id found, returning original result");
      return result;
    }

    try {
      console.log("PATCH operation - fetching complete entity with all fields");

      const completeEntity = await cds.run(
        SELECT.from(Samples) // ✅ Changed: Sample → Samples
          .where({ id: result.id })
          .columns([
            "id",
            "createdAt",
            "createdBy",
            "modifiedAt",
            "modifiedBy",
            "sampleName",
            "sampleType",
            "shipToAddress",
            "hazardous",
            "hazardousReason",
            "dueDate",
            "overdueStatusIcon",
            "status",
            "packagingHeight",
            "packagingWidth",
            "packagingMaterial",
            { ref: ["costOfSample"], expand: ["*"] },
            { ref: ["account"], expand: ["*"] },
            { ref: ["numberOfSamples"], expand: ["*"] },
            { ref: ["product"], expand: ["*"] },
            { ref: ["employee"], expand: ["*"] },
            { ref: ["opportunity"], expand: ["*"] },
            { ref: ["serviceCase"], expand: ["*"] },
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
              path: `/sap/c4c/api/v1/account-service/accounts/${entity.account.accountId}?$select=displayId,id,formattedName`,
            });

            if (accountResponse?.value) {
              entity.account = {
                accountId: accountResponse.value.id,
                name: accountResponse.value.formattedName,
                displayId: accountResponse.value.displayId,
              };
              console.log("Account enrichment completed for PATCH response");
            }
          } catch (err) {
            console.log(
              "Account enrichment failed in PATCH (non-critical):",
              err.message
            );
            // Continue without enrichment - account stays as-is
          }
        } else {
          console.log(
            "No accountId present, skipping account enrichment in PATCH"
          );
        }

        // Enrich with product data
        if (entity.product && entity.product.productId) {
          try {
            const productApi = await cds.connect.to("Product.Service");
            const productResponse = await productApi.send({
              method: "GET",
              path: `/sap/c4c/api/v1/product-service/products/${entity.product.productId}?$select=displayId,id,name`,
            });

            if (productResponse?.value) {
              entity.product = {
                productId: productResponse.value.id,
                name: productResponse.value.name,
                displayId: productResponse.value.displayId,
              };
              console.log("Product enrichment completed for PATCH response");
            }
          } catch (err) {
            console.log(
              "Product enrichment failed in PATCH (non-critical):",
              err.message
            );
            // Continue without enrichment - product stays as-is
          }
        } else {
          console.log(
            "No productId present, skipping product enrichment in PATCH"
          );
        }

        // Enrich with employee data
        if (entity.employee && entity.employee.employeeId) {
          try {
            const productApi = await cds.connect.to("Product.Service");
            const employeeResponse = await productApi.send({
              method: "GET",
              path: `/sap/c4c/api/v1/employee-service/employees/${entity.employee.employeeId}?$select=displayId,id,formattedName`,
            });

            if (employeeResponse?.value) {
              entity.employee = {
                employeeId: employeeResponse.value.id,
                name: employeeResponse.value.formattedName,
                displayId: employeeResponse.value.displayId,
              };
              console.log("Employee enrichment completed for PATCH response");
            }
          } catch (err) {
            console.log(
              "Employee enrichment failed in PATCH (non-critical):",
              err.message
            );
            // Continue without enrichment - employee stays as-is
          }
        } else {
          console.log(
            "No employeeId present, skipping employee enrichment in PATCH"
          );
        }

        return entity;
      }
    } catch (error) {
      console.error("Error in after UPDATE handler:", error);
    }

    return result;
  });

  // After READ
  // Enriches account, product, and employee details via batch calls so that on the table view all necessary details are available without additional calls
  this.after("READ", "Samples", async (samples, req) => {
    // ✅ Changed: 'Sample' → 'Samples'
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
          console.log(
            `Sample at index ${index} has no accountId, skipping account enrichment`
          );
          return;
        }
        let accountCnsEndPoint = `/sap/c4c/api/v1/account-service/accounts/${sa.account.accountId}?$select=displayId,id,formattedName`;
        accountRequestList.push({
          id: "accountCns_" + accountRequestList.length,
          url: accountCnsEndPoint,
          method: "GET",
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
              requests: accountRequestList,
            },
          });

          accountDataBatchResp.responses.forEach((eachAccDtl, batchIndex) => {
            if (eachAccDtl?.body?.value) {
              const originalSampleIndex = accountSampleIndexMap[batchIndex];
              samples[originalSampleIndex]["account"] = {
                accountId: eachAccDtl.body.value.id,
                name: eachAccDtl.body.value.formattedName,
                displayId: eachAccDtl.body.value.displayId,
              };
              console.log(
                "Account enrichment completed: " +
                  eachAccDtl.body.value.displayId +
                  " " +
                  eachAccDtl.body.value.formattedName
              );
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
          console.log(
            `Sample at index ${index} has no productId, skipping product enrichment`
          );
          return;
        }
        let productCnsEndPoint = `/sap/c4c/api/v1/product-service/products/${sa.product.productId}?$select=displayId,id,name`;
        productRequestList.push({
          id: "productCns_" + productRequestList.length,
          url: productCnsEndPoint,
          method: "GET",
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
              requests: productRequestList,
            },
          });

          productDataBatchResp.responses.forEach((eachProdDtl, batchIndex) => {
            if (eachProdDtl?.body?.value) {
              const originalSampleIndex = productSampleIndexMap[batchIndex];
              samples[originalSampleIndex]["product"] = {
                productId: eachProdDtl.body.value.id,
                name: eachProdDtl.body.value.name,
                displayId: eachProdDtl.body.value.displayId,
              };
              console.log(
                "Product enrichment completed: " +
                  eachProdDtl.body.value.displayId +
                  " " +
                  eachProdDtl.body.value.name
              );
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
          console.log(
            `Sample at index ${index} has no employeeId, skipping employee enrichment`
          );
          return;
        }
        let employeeCnsEndPoint = `/sap/c4c/api/v1/employee-service/employees/${sa.employee.employeeId}?$select=displayId,id,formattedName`;
        employeeRequestList.push({
          id: "employeeCns_" + employeeRequestList.length,
          url: employeeCnsEndPoint,
          method: "GET",
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
              requests: employeeRequestList,
            },
          });

          employeeDataBatchResp.responses.forEach((eachEmpDtl, batchIndex) => {
            if (eachEmpDtl?.body?.value) {
              const originalSampleIndex = employeeSampleIndexMap[batchIndex];
              samples[originalSampleIndex]["employee"] = {
                employeeId: eachEmpDtl.body.value.id,
                name: eachEmpDtl.body.value.formattedName,
                displayId: eachEmpDtl.body.value.displayId,
              };
              console.log(
                "Employee enrichment completed: " +
                  eachEmpDtl.body.value.displayId +
                  " " +
                  eachEmpDtl.body.value.formattedName
              );
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
});
```

12. Add to your ```package.json``` the below code directly into the cds production section. We need to add some credentials. You need to replace your tenant and credentials in the below code. Normally you would use BTP destinations here but this way we "save" a step.

After exactly the last curly bracket here:
```
  "cds": {
    "requires": {
      "[production]": {
        "db": "hana",
        "auth": "mocked"
      }
```
You must add the below code and overwrite all the curly brackets at the end:
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
      "Employee.Service": {
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

13.	Let's deploy our application now to Cloud Foundry. Enter in your terminal:

```npm install @sap-cloud-sdk/http-client @sap-cloud-sdk/resilience -save```

```npm update --package-lock-only```

```mbt build```

```cf login```

```cf deploy mta_file```

14.	Copy the app router url and try out your backend service via your browswer or any tool like "Bruno" or "Postman". Important: Do not use the "service" url but use the "application" url which is usually the second one given in the terminal.

## Metadata

15. Recommendation: Just download directly my provided and finished [metadata file](https://github.com/jens-limbach/SSv2-custom-sample-object/blob/main/LatestMetadata_V3.json) here and jump directly to [UI Generation and Testing](#ui-generation-and-testing).

Normally you would need to generate a json, convert it, edit it and only then upload it. But most of these manual adjustiments will disappear as the CAP conversion is currently undergoing a huge improvement. But anyway if you want to learn the steps for your own project, here are the steps you need to do if you want to go through this manual exercise otherwise use above file and continue with [UI Generation and Testing](#ui-generation-and-testing).

Manual Steps:

15.	Enter in the terminal ```cds -2 json .\srv\Sample-service.cds > BackendService.json``` to generate a json file based on your backend.

16.	Go to your SAP Sales and Service Cloud solution. Navigate via System Settings to your Custom Services feature. Create a new custom service entity, open th CAP json converter, convert the "BackendService.json"  file previously created and download the new metadata json file. 

Now do the following adjustments:

-   Add a unique object type code ```"objectTypeCode": "CUS1329",``` on your entity level 
-   Add a label on the top entity level ```"label": "Samples",```
-   Replace all ```"dataType": "COMPOSITION",``` with ```"dataType": "OBJECT",```
-   Add a notes api manually
-   Make sure the entityReference is referencing your Entity name which is generated based on the service definition. In my case I need to add an "s" as the generator only generated "Sample" in singular. So add to all three events an "s" so that it looks like this:
```
  "events": [
    {
      "name": "SampleCreate",
      "title": "Sample",
      "entityReference": "Samples", // here you need to add an "s" so that it fits to your entity (which is based on the service projection not on your schema)
      "trigger": "CREATE"
    },
```
-   Map all value selectors (OVS) correctly:

For Account:
1. Remove the generated "ID" field (which only holds the CAP internal ID)
2. Add to the "accountId" field the following attributes:
```
              "descriptionAttribute": "name",
              "keyType": "FOREIGN",
```
3. Change the following attributes of the "accountId" to true:
```
              "creatable": true,
              "updatable": true,
```
4. Complete the objectReference section of the "accountId" like given below:
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

-   Make the notes "creatable" and "updatable", remove admin fields (createdAt, modifiedAt, createdBy, modifiedBy) and add manually the API for the sub-structure "Notes" in the api section directly after the "Samples" API definition

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
          "path": "/{noteId}",
          "method": "READ",
          "request": {
            "pathVariables": [
              { "name": "noteId", "dataType": "STRING", "dataFormat": "UUID" }
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
          "path": "/{noteId}",
          "method": "PATCH",
          "request": {
            "pathVariables": [
              { "name": "noteId", "dataType": "STRING", "dataFormat": "UUID" }
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
          "path": "/{noteId}",
          "method": "DELETE",
          "request": {
            "pathVariables": [
              { "name": "noteId", "dataType": "STRING", "dataFormat": "UUID" }
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

## UI Generation and Testing

18. Upload the adjusted [metadata](https://github.com/jens-limbach/SSv2-custom-sample-object/blob/main/LatestMetadata_V3.json) file in custom services.
    
19.	Create the UI’s via the design tool to your custom service and add your deployed backend as the host in the configuration.
    
20.	Assign the new custom service to your user via a business role and also activate the new app.
    
21.	Refresh and test your new fully functioning "custom object" which you created via our custom service feature.
    
22.	After this is working we have a strong foundation that we can extend in many ways. We can add sophisticated logic, add many more standard features (like timeline support, related entity support, mashups etc.) or create a complete custom frontend in any programming language of our liking (like Angular) on top of our professional backend.

Your finished custom object has now a new workcenter that can be assiged to users and the end result of the generate UI should look similar to the screenshot below.

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/392753605ea2c1c0a94445b8a5d9669e94aeb0b7/images/FinishedSample.png">

## Business Logic

Let's also add some more business logic. Until now we only had logic that is required as a baseline for our service. Much more interesting is how easy it is to add some logic in different lifecycle points like before creation or before update.

23. Validation: Let's add a simple validation to the sample request on create. We want to check that the "number of samples" cannot be 0. Add the following snippet at the end of your ```sample-service.js``` before the last ```});```.
```
  // Before CREATE (only for root Sample entity)
  this.before("CREATE", Samples, (req) => {
    // ensure this runs only for the Sample root entity
    if (req.target !== Samples) return;

    const d = req.data || {};

    // Validation: numberOfSamples must be greater than zero
    if (d.numberOfSamples?.content != null && d.numberOfSamples.content <= 0) {
      return req.reject(400, "Number of Samples must be greater than zero");
    }

  });
```

24. Determination: Let's also add a simple determination before every update which is appending a red dot (or green dot) at the sample name if the sample is overdue. This time we create a small re-usable function because this logic could be used both in before create and before update. Add the following snippet at the end of your ```sample-service.js``` before the last ```});```.
```
// Before UPDATE logic
  this.before("UPDATE", Samples, (req) => {
    const d = req.data || {};

    // Determination: Set icon based on due date
    determineOverdueStatus(d);
  });

  // Shared function to determine overdue status during CREATE and UPDATE
  const determineOverdueStatus = (data) => {
    if (data.dueDate) {
      const due = new Date(data.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      data.overdueStatusIcon = due < today ? "🔴" : "🟢";
    }
  };
```

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/3524c96c9b45c74caa44d78f4751657ef9daa222/images/StatusIcon.png">

## Timeline Feature

25. Enable the timeline feature. There several configuratoin steps involved before the below code will work. You will need to go to your CRM and open the Timeline Configuration, create a new Event, configure the Account to subscribe to this event, create a new Inbound Communication System, then go to Inbound Custom Events, enable the Create event and assign your previous configured Communication System. Then finally you need to adjust the ```package.json``` with the credentials you configured in the communication system. After that you can the following snippet at the end of your ```sample-service.js``` before the last ```});```. If everything was successfull, everytime you create a new "sample" and link it with an account, the particular account will have a new event on his timeline.

<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/aebf54ee44f6043978ead358090596f8f991650c/images/TimelineEvent.png">

```
 // After CREATE - send Timeline event to CRM system
  this.after("CREATE", Samples, async (sample, req) => {
    console.log("🔔 after('CREATE') handler triggered for Timeline event");

    // Sending Timeline event - requires prior configuration in the CRM system
    try {
      // Check if account exists before proceeding
      if (!sample.account || !sample.account.accountId) {
        console.log("⚠️ No account data present, skipping Timeline event");
        return; // Skip timeline event if no account
      }

      const inboundDataConnectorService = await cds.connect.to(
        "Timeline.Service"
      );
      const randomUUID = crypto.randomUUID();
      const payload = {
        id: randomUUID,
        subject: sample.id,
        type: "customer.ssc.sampleservice.event.SampleCreate",
        specversion: "0.2",
        source: "614cd785fe86ec5c905b4a00",
        time: new Date().toISOString(), // "2024-11-11T01:10:00.180Z",
        datacontenttype: "application/json",
        data: {
          currentImage: {
            id: sample.id,
            sampleName: sample.sampleName,
            status: sample.status,
            account: {
              accountId: sample.account.accountId,
            },
          },
        },
      };

      console.log(
        "📤 Sending Timeline event payload:",
        JSON.stringify(payload, null, 2)
      );

      const sendActionResp = await inboundDataConnectorService.send({
        method: "POST",
        path: `/sap/c4c/api/v1/inbound-data-connector-service/events`,
        headers: {
          "Content-Type": "application/json",
          Accept: "*/*",
        },
        data: payload,
      });

      console.log(
        "✅ Timeline event sent successfully. Response:",
        JSON.stringify(sendActionResp, null, 2)
      );
    } catch (err) {
      console.error("❌ Timeline event failed:", err.message);
      // Don't reject - just log error and continue (non-critical)
      console.log(
        "Timeline event is optional, continuing with sample creation"
      );
    }
  });
```

## Related Entities Feature
(Preview - not yet fully released)

It is possible to link your custom object as a successor or predecessor to your standard objects. This is only a simple configuration and then they will appear as linkable in your standard object under the "Related Entity" section. See screenshots below.

Enable your custom object for related entities:
<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/392753605ea2c1c0a94445b8a5d9669e94aeb0b7/images/ConfigureRelatedEntities1.png">

Link your custom object to a standard entity:
<img src="https://raw.githubusercontent.com/jens-limbach/SSv2-extensibility-workshop/392753605ea2c1c0a94445b8a5d9669e94aeb0b7/images/ConfigureRelatedEntities2.png">

## Custom Frontend build with AI

Now we have a great generated frontend in our standard solution already but often you can have the biggest business impact by developing a very tailored feature especially on the frontend side. Today this is very quickly done and especially having an enterprise ready backend, it is just adding the cherry on the top. In the following Github I created as a non-developer within a few hours a very powerful frontend which can be embedded directly and seamless in SAP Sales and Service Cloud. After you finished the above tutorial, check this seperate git out to learn how to build a [custom frontend using AI](https://github.com/jens-limbach/SSv2-custom-frontend-ai) on top of our sample backend. 

## Documentation

- [How to build a custom service? (this tutorial)](https://github.com/jens-limbach/SSv2-custom-sample-object)
- [Custom Services Documentation](https://help.sap.com/docs/CX_NG_SVC/56436b4e8fa84dc8b4408c7795a012c4/7cb6b3e19b984d6c9d7f16d0f387e6b0.html)
- [Metadata Guidelines](https://help.sap.com/docs/CX_NG_SVC/56436b4e8fa84dc8b4408c7795a012c4/cc336c1290e9483994d277d354f34dcb.html)
- [CAP File Conversion](https://help.sap.com/docs/CX_NG_SVC/56436b4e8fa84dc8b4408c7795a012c4/760adeb672fb42229873e45a6bb379a7.html)
- [SAP CAP Documentation](https://cap.cloud.sap/docs/)
- [Timeline Configuration](https://help.sap.com/docs/CX_NG_SALES/ea5ff8b9460a43cb8765a3c07d3421fe/26080206ef8b403183e46fbe8ba5179f.html)
- [General Extensibility of SAP Sales and Service Cloud](https://help.sap.com/docs/CX_NG_SALES/ea5ff8b9460a43cb8765a3c07d3421fe/90214e2fe20940dd8cd68c25742c4f9b.html)
- [Jens' Extensibility Workshop for Beginners of Side-by-Side Extensiblity](https://github.com/jens-limbach/SSv2-extensibility-workshop)

## 🚀 Extensions - Wanna Know More?

Are you interested how you can extend SAP Sales and Service Cloud Version 2? I cover each recommended possibility from in-app to pro-code in my videos and hands-on tutorials!

The videos show you step-by-step how to do it and not only the "finished" extensions and the tutorials complement those by giving you each single step in order to try it out yourself or to use it for a hands-on workshop! All you need is the curiosity to learn something new 😊

### Topics:

- **Basic customizing** ([Video 3m](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_wt8hh8ye))
- **In-App Extensibility** ([Video 5m](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_w7vhb24g))
- **Extensibility Workshop** ([Video 17m](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_52m7tuyh) | [Hands-On Tutorial](https://github.com/jens-limbach/SSv2-Workshop))
  - First Side-by-Side app on BTP
  - Custom Logic via a Microservice (trigger via Autoflow)
  - Custom Key Metrics
- **Building a Custom Object with standard frontend** ([Video 18m](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_j5slmbgc) | [Hands-On Tutorial](https://github.com/jens-limbach/SSv2-custom-sample-object))
- **Building a custom frontend using AI** ([Video 15m](https://sapvideo.cfapps.eu10-004.hana.ondemand.com/?entry_id=1_17l2ao1d) | [Hands-On Tutorial](https://github.com/jens-limbach/SSv2-custom-frontend-ai))

## Todos

Planned Todo's for this Tutorial:
- Update the End to End Video to the latest version
- Review all the nodeJS code (especially the part with the scalar fields)
- Add the related entity and document flow topics
- Add a service for "custom key metrics"
- Add example for multiple error messages including warnings and info messages
- Add more explanations around the connections in package.json and the cloud sdk
- Add few more screenshots to certain sections