namespace sap.capire.customservice;

using {managed} from '@sap/cds/common';

@isRoot
entity Sample : managed {
    key ID                : UUID;

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
        notes             : Composition of many Note on notes.sampleID = ID;
}

// Structured data type for Amount and Quantity
@isCnsEntity: true
entity Amount {
    key ID           : UUID;
        currencyCode : String;
        content      : Decimal(10, 2);
}

@isCnsEntity: true
entity Quantity {
    key ID        : UUID;
    content       : Integer;
    unitOfMeasure : String;
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
    key ID   : UUID;
        note : String(1000);
        sampleID : UUID;  // Foreign key to Sample
}

// Associated CRM entities

@isCnsEntity: true
entity Product {
    key ID                : UUID;
        productID         : UUID;
        displayId         : String;
        @description name : String(255);
}

@isCnsEntity: true
entity Account {
    key ID                : UUID;
        accountID         : UUID;
        displayId         : String;
        @description name : String(255);
}

@isCnsEntity: true
entity Opportunity {
    key ID                : UUID;
        opportunityID     : UUID;
        displayId         : String;
        @description name : String(255);
}

@isCnsEntity: true
entity ServiceCase {
    key ID                : UUID;
        serviceCaseID     : UUID;
        displayId         : String;
        @description name : String(255);
}

@isCnsEntity: true
entity Employee {
    key ID                : UUID;
        employeeID        : UUID;
        displayId         : String;
        @description name : String(255);
}
