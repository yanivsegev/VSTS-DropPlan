var _iteration;
var _daysOff;
var _witClient;
var _projectId;
var _witServices;
var _iterationId;
var _teamValues;
var _backlogConfigurations;
var _workItemTypes;
var _workItemPBITypes;
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
                

                if ( window._trackJs && typeof trackJs != "undefined"){

                    trackJs.configure({version: extVersion});
                                                                                                                                                                                                                                                trackJs.addMetadata("VssSDKRestVersion",VSS.VssSDKRestVersion);
                    trackJs.addMetadata("VssSDKRestVersion",VSS.VssSDKRestVersion);
 +                  trackJs.addMetadata("VssSDKVersion",VSS.VssSDKVersion);

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
                        _workItemPBITypes = _backlogConfigurations.requirementBacklog.workItemTypes;
                    }else{
                        _workItemTypes = [{name: "Task"}];
                        _workItemPBITypes = [{name:'Product Backlog Item'},{name:'Bug'}];
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

function refreshPlan() {
    $("#refreshPlanBtn").css('opacity', '0');
    queryAndRenderWit();
}

function processAllWorkItems(values) {

    reportProgress("Work items details loaded.");
    
    var merged = jQuery.grep([].concat.apply([], values), function( elm, i ) { return elm.id > 0; });
    var tasks = jQuery.grep(merged, function( elm, i ) { return jQuery.grep( _workItemTypes , function(element){ return element.name == elm.fields["System.WorkItemType"]; }).length > 0; });
    
    if (tasks.length == 0) {
        var container = document.getElementById("grid-container");
        reportFailure("No work items of type 'Task' found.");
    }
    else{
        processWorkItems(merged, false);
    }

}
function processWorkItems(workItems, isSaving) {

    console.log("Work items data loaded. (" + (performance.now() - t0) + " ms.)");

    sprint = new SprintData(workItems, _iteration.attributes.startDate, _iteration.attributes.finishDate);

    container = document.getElementById("grid-container");;

    var data = getTable();
    var cols = getColumns();
    
    render(isSaving, data, cols);

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

function pushWitToSave(witId) {
    var wit = sprint.GetWorkitemById(witId);
    if (wit && _witToSave.indexOf(witId) == -1) {
        _witToSave.push(witId);
    }
}

function updateWorkItemInVSS() {

    var needSave = _witToSave.length > 0;
    var promises = [];
    console.log("Saving Items: " + _witToSave.join(", "));
    
    if (needSave) {
        _witToSave.forEach(function (item, index) {
            var workItem = sprint.GetWorkitemById(item);
            if (workItem){
                var wijson =
                    [{
                        "op": "add",
                        "path": "/fields/Microsoft.VSTS.Scheduling.FinishDate",
                        "value": workItem.FinishDate.yyyy_mm_dd()
                    },
                    {
                        "op": "add",
                        "path": "/fields/Microsoft.VSTS.Scheduling.StartDate",
                        "value": workItem.StartDate.yyyy_mm_dd()
                    },
                    {
                        "op": "add",
                        "path": "/fields/System.AssignedTo",
                        "value": workItem.AssignedTo
                    }];

                if (!workItem.StartDate) {
                    wijson =
                        [{
                            "op": "remove",
                            "path": "/fields/Microsoft.VSTS.Scheduling.FinishDate",
                            "value": workItem.FinishDate.yyyy_mm_dd()
                        },
                        {
                            "op": "remove",
                            "path": "/fields/Microsoft.VSTS.Scheduling.StartDate",
                            "value": workItem.StartDate.yyyy_mm_dd()
                        }];
                }
                workItem.UpdateRawData();
                pushWitInUpdate(workItem.Id);
                promises.push(_witClient.updateWorkItem(wijson, workItem.Id));
            }
        });
    }

    processWorkItems(sprint.RawWits, needSave);

    _witToSave = [];
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
        sprint.Wits.forEach(function (item, index) {
            if (item.isTaskWit) {
                item.FinishDate = undefined;
                item.StartDate = undefined;
                item.UpdateRawData();
                pushWitToSave(item.Id);
            }
        });
        processWorkItems(sprint.RawWits, false);
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

