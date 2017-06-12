

var _iteration;
var _daysOff;
var _witClient;
var _projectId;
var _witServices;
var _iterationId;
var _teamValues;

VSS.init({
    explicitNotifyLoaded: true,
    usePlatformScripts: true
});

function printToScreen(msg){
    $("#loading").innerHTML = $("#loading").innerHTML + msg + "<br/>";
    console.log(msg);
}

function BuildDropPlan()
{
    VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/Work/RestClient", "TFS/WorkItemTracking/Services"],
        function (VSS_Service, TFS_Wit_WebApi, TFS_Work, TFS_Wit_Services) {

        printToScreen("VSS loaded.");

        var context = VSS.getWebContext();
        var workClient = TFS_Work.getClient()
        var teamContext = { projectId: context.project.id, teamId: context.team.id, project: "", team: "" }; 
        
        _witServices = TFS_Wit_Services;
        _iterationId = VSS.getConfiguration().iterationId;
        _projectId = context.project.id;
        _witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);

        var serverAnswer = Promise.all([
            workClient.getTeamDaysOff(teamContext, _iterationId),
            workClient.getTeamSettings(teamContext),
            workClient.getCapacities(teamContext, _iterationId),
            workClient.getTeamIteration(teamContext, _iterationId),
            workClient.getTeamFieldValues(teamContext)
        ]).then(values => {

            printToScreen("Team data loaded.");
        
            _daysOff = values[0];
            _teamSettings = values[1];
            _teamMemberCapacities = values[2];
            _iteration = values[3];
            _teamValues = values[4];
            queryAndRenderWit();
        }, failToCallVss);
    });
}

function queryAndRenderWit(){

    var currentIterationPath = _iteration.path;
            
    // Query object containing the WIQL query
    var query = {
        query: "SELECT [System.Id] FROM WorkItem WHERE [System.State] NOT IN ('Removed') AND [System.WorkItemType] = 'Task' AND [System.IterationPath] UNDER '" + currentIterationPath + "' "
    };
    if (_teamValues.values.length > 0)
    {
        query.query = query.query + " AND (";
        $.each(_teamValues.values, function (index, item){
            if (index > 0){
                query.query = query.query + " OR ";
            } 
            query.query = query.query + "[" + _teamValues.field.referenceName + "] ";
            if (item.includeChildren == true)
            {
                query.query = query.query + "UNDER";
            }
            else
            {
                query.query = query.query + "=";
            }

            query.query = query.query + " '" + item.value + "'";
        });
        
        query.query = query.query + " )";
    }
    // Executes the WIQL query against the active project
    _witClient.queryByWiql(query, _projectId).then(
    function (result) {

        printToScreen("Iteration data loaded.");
        
        //console.log("queryByWiql loaded");
        // Generate an array of all open work item ID's
        var openWorkItems = result.workItems.map(function (wi) { return wi.id });

        var container = document.getElementById("grid-container");
        if (openWorkItems == 0)
        {
            container.innerHTML = 'No items found';
            VSS.notifyLoadSucceeded();
        }
        else if (!_iteration.attributes.startDate || !_iteration.attributes.finishDate)
        {
            container.innerHTML = 'Please set iteration dates';
            VSS.notifyLoadSucceeded();
        }
        else
        {
            _witClient.getWorkItems(openWorkItems, undefined, undefined, 1).then( processWorkItems, failToCallVss );
        }

    }, failToCallVss);

}

function processWorkItems(workItems, isGMT) {
    
    printToScreen("Work items data loaded.");
        
    var t = document.getElementById("grid-container");
    setData(t, workItems, _iteration.attributes.startDate, _iteration.attributes.finishDate);

    process(isGMT);
    attachEvents();
    VSS.notifyLoadSucceeded();
}

function updateWorkItemInVSS(workItemIdhtml)
{
    var workItem = workItems[workItemIdhtml];

    VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/Work/RestClient"], 
        function (VSS_Service, TFS_Wit_WebApi, TFS_Work, TFS_Wit_Services) {
        _witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);

        var wijson = 
        [{
            "op": "add",
            "path": "/fields/Microsoft.VSTS.Scheduling.FinishDate",
            "value": workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"]
            },
            {
            "op": "add",
            "path": "/fields/Microsoft.VSTS.Scheduling.StartDate",
            "value": workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]
            },
            {
            "op": "add",
            "path": "/fields/System.AssignedTo",
            "value": workItem.fields["System.AssignedTo"] || ""
        }]
        //console.log( 'updateWorkItemInVSS - ' + workItem.id + ' ' + workItem.fields["Microsoft.VSTS.Scheduling.StartDate"] + ' ' + workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"]  )
        processWorkItems(workItems, true);
        _witClient.updateWorkItem(wijson, workItem.id).then(x => {
            queryAndRenderWit();
        }, failToCallVss);
    }, failToCallVss);
}

function failToCallVss() {
    alert("Call to server failed! please refresh the page.");
}

BuildDropPlan();