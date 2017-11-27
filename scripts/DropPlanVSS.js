

var _iteration;
var _daysOff;
var _witClient;
var _projectId;
var _witServices;
var _iterationId;
var _teamValues;
var _backlogConfigurations;
var _workItemTypes;
var t0 = performance.now();
var _scrollToToday = true;
var _shouldReportProgress = true;

function reportProgress(msg){
    var messages = document.getElementById("messages");
    if (messages){
        messages.innerHTML = messages.innerHTML + msg + "<br/>";
    }
}

function reportFailure(msg){

    var messages = document.getElementById("messageBoxInner");
    messages.innerHTML = "<h1>" + msg + "</h1>";
}    

function BuildDropPlan() {
    console.log("Stating. (" + (performance.now() - t0) + " ms.)");
    
    VSS.init({
        explicitNotifyLoaded: true,
        usePlatformScripts: false,
        usePlatformStyles: true
    });
    
    VSS.ready(function () {
        VSS.register(VSS.getContribution().id, {});
        VSS.notifyLoadSucceeded();
    });
    
    console.log("VSS init. (" + (performance.now() - t0) + " ms.)");
    
    VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/Work/RestClient", "TFS/WorkItemTracking/Services"],
        function (VSS_Service, TFS_Wit_WebApi, TFS_Work, TFS_Wit_Services) {
            try {
                extVersion = VSS.getExtensionContext().version;
                
                console.log("VSS loaded V " + extVersion + " VssSDKRestVersion:" + VSS.VssSDKRestVersion + " VssSDKVersion:" + VSS.VssSDKVersion + ". (" + (performance.now() - t0) + " ms.)");
                reportProgress("Framework loaded.");
                

                if ( window._trackJs ){

                    trackJs.configure({version: extVersion});
                    trackJs.addMetadata("VssSDKVersion",VSS.VssSDKRestVersion);
                    trackJs.addMetadata("VssSDKVersion",VSS.VssSDKVersion);

                }
                
                var context = VSS.getWebContext();
                var workClient = TFS_Work.getClient();
                var teamContext = { projectId: context.project.id, teamId: context.team.id, project: "", team: "" };

                _witServices = TFS_Wit_Services;
                _iterationId = VSS.getConfiguration().iterationId;
                _projectId = context.project.id;
                _witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);

                var promisesList = [
                    workClient.getTeamDaysOff(teamContext, _iterationId),
                    workClient.getTeamSettings(teamContext),
                    workClient.getCapacities(teamContext, _iterationId),
                    workClient.getTeamIteration(teamContext, _iterationId),
                    workClient.getTeamFieldValues(teamContext),
                    VSS.getService(VSS.ServiceIds.ExtensionData)
                ];

                if (workClient.getBacklogConfigurations){
                    promisesList.push(workClient.getBacklogConfigurations(teamContext));
                }
                
                var serverAnswer = Promise.all(promisesList).then(function (values) {

                    console.log("Team data loaded. (" + (performance.now() - t0) + " ms.)");
                    reportProgress("Team settings loaded.");
                    _daysOff = values[0];
                    _teamSettings = values[1];
                    _teamMemberCapacities = values[2];
                    _iteration = values[3];
                    _teamValues = values[4];
                    _dataService = values[5];
                    if (values.length > 6){
                        _backlogConfigurations = values[6];
                        _workItemTypes = _backlogConfigurations.taskBacklog.workItemTypes;
                    }else{
                        _workItemTypes = [{name: "Task"}];
                    }
                    queryAndRenderWit();
                    loadThemes();
                    

                }, failToCallVss);
            }
            catch (e) {
                console.log(e);
                reportFailure("Browser is not supported.");
            }
        });
}

function queryAndRenderWit() {

    var currentIterationPath = _iteration.path;

    // Query object containing the WIQL query
    var query = {
        query: "SELECT [System.Id] FROM WorkItem WHERE [System.State] NOT IN ('Removed') AND [System.IterationPath] UNDER '" + currentIterationPath.replace("'","''") + "' "
    };
    if (_teamValues.values.length > 0) {
        query.query = query.query + " AND (";
        $.each(_teamValues.values, function (index, item) {
            if (index > 0) {
                query.query = query.query + " OR ";
            }
            query.query = query.query + "[" + _teamValues.field.referenceName.replace("'","''") + "] ";
            if (item.includeChildren == true) {
                query.query = query.query + "UNDER";
            }
            else {
                query.query = query.query + "=";
            }

            query.query = query.query + " '" + item.value.replace("'","''") + "'";
        });

        query.query = query.query + " )";
    }
    // Executes the WIQL query against the active project
    _witClient.queryByWiql(query, _projectId).then(
        function (result) {

            console.log("Iteration data loaded. (" + (performance.now() - t0) + " ms.)");
            reportProgress("Work items list loaded.");
            _shouldReportProgress = false;
            // Generate an array of all open work item ID's
            var openWorkItems = result.workItems.map(function (wi) { return wi.id });

            var container = document.getElementById("grid-container");

            if (openWorkItems.length == 0) {
                reportFailure("No work items found.");
            }
            else if (!_iteration.attributes.startDate || !_iteration.attributes.finishDate) {
                reportFailure("Please set iteration dates.");
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

    return jQuery.grep( _workItemTypes , function(element){ return element.name == wit.fields["System.WorkItemType"]; }).length > 0 

}

function refreshPlan() {
    $("#refreshPlanBtn").css('opacity', '0');
    queryAndRenderWit();
}

function processAllWorkItems(values) {

    var merged = jQuery.grep([].concat.apply([], values), function( elm, i ) { return elm.id > 0; });
    var tasks = jQuery.grep(merged, function( elm, i ) { return isTaskWit(elm); });
    
    if (tasks.length == 0) {
        var container = document.getElementById("grid-container");
        reportFailure("No work items of type 'Task' found.");
    }
    else{
        processWorkItems(merged, false, false);
    }

}
function processWorkItems(workItems, isGMT, isSaving) {

    console.log("Work items data loaded. (" + (performance.now() - t0) + " ms.)");

    var t = document.getElementById("grid-container");
    setData(t, workItems, _iteration.attributes.startDate, _iteration.attributes.finishDate);

    process(isGMT, isSaving);
    attachEvents();
    drawRelations();
    AlignTitlesToView();

    TableLock_clear();
    TableLock("tasksTable", "row_class_name", "column_class_name", "locked_class_name");
    
    $("#options").css("display", "flex");

    if ($('.taskToday')[0] && _scrollToToday) {
        _scrollToToday = false;
        $(window).scrollLeft($('.taskToday').offset().left - $(".assignToColumn").width() - $(".mainBody").width() / 2);
    }
}

function isWitInUpdate(id) {
    if (_witInUpdate.indexOf(id) == -1) {
        return false;
    }
    return true;
}

function pushWitInUpdate(id) {
    if (!isWitInUpdate(id)) {
        _witInUpdate.push(id);
    }
}

function removeWitInUpdate(id) {
    var index = _witInUpdate.indexOf(id);
    if (index > -1) {
        _witInUpdate.splice(index, 1);;
    }
}

function pushWitToSave(workItemIdhtml) {
    var id = parseInt(workItemIdhtml);
    if (_witToSave.indexOf(id) == -1) {
        _witToSave.push(id);
        _witIdsToSave.push(workItems[id].id);
    }
}

function updateWorkItemInVSS() {

    var needSave = _witToSave.length > 0;
    var promises = [];
    console.log("Saving Items: " + _witIdsToSave.join(", "));
    
    if (needSave) {
        _witToSave.forEach(function (item, index) {
            var workItem = workItems[item];
            if (workItem){
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
                pushWitInUpdate(workItem.id);
                promises.push(_witClient.updateWorkItem(wijson, workItem.id));
            }
        });
    }

    processWorkItems(workItems, true, needSave);

    _witToSave = [];
    _witIdsToSave = [];
    if (promises.length > 0) {
        Promise.all(promises).then(function (x) {
            x.forEach(function(item1,index1) {
                removeWitInUpdate(item1.id);
            });
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
        processWorkItems(workItems, true, false);
    }
}

function failToCallVss(reason) {
    console.log("Call to server failed! reason: " + JSON.stringify(reason));

    if (reason && reason.message){
        alert(reason.message);
    }
    else{
        alert("Call to server failed! please refresh the page.");
    }
}

BuildDropPlan();

