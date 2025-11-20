using {sap.capire.customservice as sampleschema} from '../db/schema';

service SampleService @(path: '/sample-service') {

    // Projections so that we have those endpoints ready for our frontend application
    @odata.draft.bypass
    entity Samples as projection on sampleschema.Sample;
    entity Notes        as projection on sampleschema.Note;

    // Events for Timeline and Autoflow in SAP Sales and Service Cloud V2
    event SampleCreate {};
    event SampleUpdate {};
    event SampleDelete {};
}