

var _iteration;
var _daysOff;
var _witClient;
var _projectId;
var _witServices;
var _iterationId;
var _teamValues;
var _backlogConfigurations;
var t0 = performance.now();
var _scrollToToday = true;

function BuildDropPlan() {
    console.log("Stating. (" + (performance.now() - t0) + " ms.)");
    
    VSS.init({
        explicitNotifyLoaded: true,
        usePlatformScripts: false,
        usePlatformStyles: true
    });
    
    VSS.ready(function () {
        VSS.register(VSS.getContribution().id, {});
    });
    
    console.log("VSS init. (" + (performance.now() - t0) + " ms.)");
    
    VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/Work/RestClient", "TFS/WorkItemTracking/Services"],
        function (VSS_Service, TFS_Wit_WebApi, TFS_Work, TFS_Wit_Services) {
            try {
                console.log("VSS loaded. (" + (performance.now() - t0) + " ms.)");

                var context = VSS.getWebContext();
                var workClient = TFS_Work.getClient();
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
                    workClient.getTeamFieldValues(teamContext),
                    VSS.getService(VSS.ServiceIds.ExtensionData),
                    workClient.getBacklogConfigurations(teamContext)
                ]).then(function (values) {

                    console.log("Team data loaded. (" + (performance.now() - t0) + " ms.)");

                    _daysOff = values[0];
                    _teamSettings = values[1];
                    _teamMemberCapacities = values[2];
                    _iteration = values[3];
                    _teamValues = values[4];
                    _dataService = values[5];
                    _backlogConfigurations = values[6];

                    queryAndRenderWit();
                    loadThemes();

                }, failToCallVss);
            }
            catch (e) {
                console.log(e);
                $("#grid-container")[0].innerHTML = "<h1>Browser is not supported.</h1>";
                VSS.notifyLoadFailed();
            }
        });
}

function queryAndRenderWit() {

    var currentIterationPath = _iteration.path;

    // Query object containing the WIQL query
    var query = {
        query: "SELECT [System.Id] FROM WorkItem WHERE [System.State] NOT IN ('Removed') AND [System.IterationPath] UNDER '" + currentIterationPath + "' "
    };
    if (_teamValues.values.length > 0) {
        query.query = query.query + " AND (";
        $.each(_teamValues.values, function (index, item) {
            if (index > 0) {
                query.query = query.query + " OR ";
            }
            query.query = query.query + "[" + _teamValues.field.referenceName + "] ";
            if (item.includeChildren == true) {
                query.query = query.query + "UNDER";
            }
            else {
                query.query = query.query + "=";
            }

            query.query = query.query + " '" + item.value + "'";
        });

        query.query = query.query + " )";
    }
    // Executes the WIQL query against the active project
    _witClient.queryByWiql(query, _projectId).then(
        function (result) {

            console.log("Iteration data loaded. (" + (performance.now() - t0) + " ms.)");

            // Generate an array of all open work item ID's
            var openWorkItems = result.workItems.map(function (wi) { return wi.id });

            var container = document.getElementById("grid-container");

            if (openWorkItems.length == 0) {
                container.innerHTML = '<h1>No work items found.</h1>';
                VSS.notifyLoadSucceeded();
            }
            else if (!_iteration.attributes.startDate || !_iteration.attributes.finishDate) {
                container.innerHTML = '<h1>Please set iteration dates.</h1>';
                VSS.notifyLoadSucceeded();
            }
            else {
                var start = 0;
                var end = 0;
                var getWorkItemsPromises = [];
                while (end < openWorkItems.length) {
                    end = start + 200;
                    getWorkItemsPromises.push(_witClient.getWorkItems(openWorkItems.slice(start, end), undefined, undefined, 1));
                    start = end;
                }
                Promise.all(getWorkItemsPromises).then(processAllWorkItems, failToCallVss);
            }

        }, failToCallVss);

}

function isTaskWit(wit){

    return jQuery.grep( _backlogConfigurations.taskBacklog.workItemTypes , function(element){ return element.name == wit.fields["System.WorkItemType"]; }).length > 0 

}

function refreshPlan() {
    $("#refreshPlanBtn").css('opacity', '0');
    queryAndRenderWit();
}

function processAllWorkItems(values) {

    var merged = [].concat.apply([], values);
    var tasks = jQuery.grep(merged, function( elm, i ) { return isTaskWit(elm); });

    if (tasks.length == 0) {
        var container = document.getElementById("grid-container");
        container.innerHTML = '<h1>No work items of type "Task" found.</h1>';
        VSS.notifyLoadSucceeded();
    }
    else{
        processWorkItems(merged, false, true);
    }

}
function processWorkItems(workItems, isGMT, allowChangeEvents) {

    console.log("Work items data loaded. (" + (performance.now() - t0) + " ms.)");

    var t = document.getElementById("grid-container");
    setData(t, workItems, _iteration.attributes.startDate, _iteration.attributes.finishDate);

    process(isGMT);
    attachEvents(allowChangeEvents);
    drawRelations();
    AlignTitlesToView();

    TableLock("tasksTable", "row_class_name", "column_class_name", "locked_class_name");

    $("#options").css("display", "flex");

    if ($('.taskToday')[0] && _scrollToToday) {
        _scrollToToday = false;
        $(window).scrollLeft($('.taskToday').offset().left - $(".assignToColumn").width() - $(".mainBody").width() / 2);
    }
    VSS.notifyLoadSucceeded();
}

function pushWitToSave(workItemIdhtml) {
    if (_witToSave.indexOf(parseInt(workItemIdhtml)) === -1) {
        _witToSave.push(parseInt(workItemIdhtml));
    }
}

function updateWorkItemInVSS() {

    var needSave = _witToSave.length > 0;

    if (needSave) {
        var promises = [];
        _witToSave.forEach(function (item, index) {
            var workItem = workItems[item];
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
                }];

            if (!workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]) {
                wijson =
                    [{
                        "op": "remove",
                        "path": "/fields/Microsoft.VSTS.Scheduling.FinishDate",
                        "value": workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"]
                    },
                    {
                        "op": "remove",
                        "path": "/fields/Microsoft.VSTS.Scheduling.StartDate",
                        "value": workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]
                    }];
            }

            promises.push(_witClient.updateWorkItem(wijson, workItem.id));
        });
    }

    processWorkItems(workItems, true, !needSave);

    if (needSave) {
        _witToSave = [];
        Promise.all(promises).then(function (x) {
            queryAndRenderWit();
        }, failToCallVss);
    }
}

function ResetTasks() {

    if (confirm("Are you sure you want to rearrange all tasks?")) {
        console.log("Reset Tasks")
        workItems.forEach(function (item, index) {
            if (isTaskWit(item)) {
                item.fields["Microsoft.VSTS.Scheduling.FinishDate"] = undefined;
                item.fields["Microsoft.VSTS.Scheduling.StartDate"] = undefined;
                pushWitToSave(index);
            }
        });
        processWorkItems(workItems, true, true);
    }
}

function failToCallVss() {
    console.log("Call to server failed! please refresh the page.")
    alert("Call to server failed! please refresh the page.");
}

BuildDropPlan();

