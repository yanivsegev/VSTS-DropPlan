var repository = new VSSRepository();

var sprint, container;
var _scrollToToday = true;
var autoRefresh;
var showFailAlerts = true;
var dropPlanLoaded = false;

window.addEventListener("message", receiveMessage, false);

document.addEventListener("visibilitychange", () => {
    if (dropPlanLoaded) {
        if (document.hidden) {
            console.log("Pause refresh in background");
            PauseAutoRefresh();
            /*// Reduce the number of refreshes if the tab is in the background to once every 7 minutes (prime number)
            ResumeAutoRefresh(420000);*/
            showFailAlerts = false;
        } else {
            console.log("foreground refresh")
            SetAutoRefresh()
        }
    }
});

function receiveMessage(event) {
    try {
        var result = JSON.parse(event.data);
        if (result.result.fields) {
            console.log("Refresh.");
            repository.LoadWorkItems();
        }
        if (result.error)
        {
            console.log("Error in receiveMessage: " + result.error);
        }

    } catch (error) {

    }
}

function switchViewByTasks(viewByTasks){
    sprint.ViewByTasks = viewByTasks;
    $("#resetTasksBtn").attr("disabled", !viewByTasks);
    processWorkItems(sprint.RawWits, false);
}

function switchViewNonWorkingTeamDays(showNonWorkingTeamDays){
    repository.SetValueInExtensionDataPerUser("ShowTeamNonWorkingDays", showNonWorkingTeamDays).then(()=>{
        processWorkItems(sprint.RawWits, false);
    });
}

function changeHighlight(newHighlight){
    $('body').removeClass(`show${sprint.Highlight}`);
    sprint.Highlight = newHighlight;
    if(sprint.Highlight){
        $('body').addClass(`show${sprint.Highlight}`);
    }
}


var timerid;
$("#filterBy").on("input", function(e) {
  sprint.FilterTerm = $('#filterBy').val();
  sprint.FilterArea = $('#filterArea').val();
  processWorkItems(sprint.RawWits, false);
});

$("#filterArea").on("change", function(e) {
    sprint.FilterTerm = $('#filterBy').val();
    sprint.FilterArea = $('#filterArea').val();
    processWorkItems(sprint.RawWits, false);
});

function reportProgress(msg){
    var messages = document.getElementById("messages");
    if (messages){
        messages.innerHTML = messages.innerHTML + msg + "<br/>";
    }
}

function reportFailure(msg){
    var messages = document.getElementById("messageBoxInner");
    messages.innerHTML = "<h1>" + msg + "</h1>";
    console.log(msg);
}

function BuildDropPlan() {
    try{
        repository.reportProgress = reportProgress;
        repository.reportFailure = reportFailure;
        repository.failToCallVss = failToCallVss;
        repository.WorkItemsLoaded = WorkItemsLoaded;
        repository.Init();
    } catch (error) {
        alertUser(undefined, error);
    }
}

function WorkItemsLoaded(workItems){
    $("#updateTime").html(new Date().HHmmss());
    if (sprint && sprint.IsSameWorkItems(workItems)) {
        console.info("No changes detected.")
    }
    else{
        processWorkItems(workItems, false);
    }
}


function autoRefreshPlan() {
    showFailAlerts = false;
    refreshPlan();
}

function refreshPlan() {
    $("#refreshPlanBtn").css('opacity', '0');
    repository.LoadWorkItems();
    
    SetAutoRefresh();
}


function processWorkItems(workItems, isSaving) {
    try {
        
        sprint = new SprintData(workItems, repository, sprint);

        container = document.getElementById("grid-container");

        const data = sprint.GetData();
        console.log("Sprint Data loaded.");

        dettachEvents();
        render(isSaving, data);
        attachEvents();

        console.log("Render done.");
        
        drawRelations();
        AlignTitlesToView();

        TableLock_clear();
        TableLock("tasksTable", "row_class_name", "column_class_name", "locked_class_name");
        
        $("#options").css("display", "flex");

        if ($('.taskToday')[0] && _scrollToToday) {
            _scrollToToday = false;
            $(window).scrollLeft($('.taskToday').offset().left - $(".assignToColumn").width() - $(".mainBody").width() / 2);
        }

        dropPlanLoaded = true;
        SetAutoRefresh();
    
    } catch (error) {
        alertUser(undefined, error);
    }
}

function SetAutoRefresh(){
    PauseAutoRefresh();
    ResumeAutoRefresh();
    showFailAlerts = true;
}

function PauseAutoRefresh(){
    clearTimeout(autoRefresh);
}

function ResumeAutoRefresh(refreshTime = 17000){
    // using a prime number for scheduling reduces the chance of multiple things running at once.
    autoRefresh = setTimeout(autoRefreshPlan, refreshTime);
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

function clearWitInUpdate() {
    _witInUpdate = [];
}

function pushWitToSave(witId) {
    var wit = sprint.GetWorkitemByIdFromAll(witId);
    if (wit && _witToSave.indexOf(wit.Id) == -1) {
        _witToSave.push(wit.Id);
    }
}

function updateWorkItemInVSS() {

    var needSave = _witToSave.length > 0;
    var promises = [];
    
    if (needSave) {
        console.log("Saving Items: " + _witToSave.join(", "));
        _witToSave.forEach(function (item, index) {
            var workItem = sprint.GetWorkitemByIdFromAll(item);
            if (workItem){
                var wijson = [];
                if (workItem.AssignedToComboName != workItem.InitialAssignedToComboName){
                    wijson.push({
                        "op": "add",
                        "path": "/fields/System.AssignedTo",
                        "value": workItem.AssignedToComboName
                    });
                }

                if (workItem.StartDate?.yyyy_mm_dd() != workItem.InitialStartDate?.yyyy_mm_dd()){
                    if (!workItem.StartDate) {
                        wijson.push({
                            "op": "remove",
                            "path": "/fields/Microsoft.VSTS.Scheduling.StartDate",
                            "value": null
                        });
                    }else{
                        wijson.push({
                            "op": "add",
                            "path": "/fields/Microsoft.VSTS.Scheduling.StartDate",
                            "value": workItem.StartDate?.yyyy_mm_dd() || ""
                        });
                    }
                }

                if (workItem.FinishDate?.yyyy_mm_dd() != workItem.InitialFinishDate?.yyyy_mm_dd()){
                    if (!workItem.FinishDate) {
                        wijson.push({
                            "op": "remove",
                            "path": "/fields/Microsoft.VSTS.Scheduling.FinishDate",
                            "value": null
                        });
                    }else{
                        wijson.push({
                            "op": "add",
                            "path": "/fields/Microsoft.VSTS.Scheduling.FinishDate",
                            "value": workItem.FinishDate?.yyyy_mm_dd() || ""
                        });
                    }
                }
                
                if (wijson.length > 0){
                    workItem.UpdateRawData();
                    pushWitInUpdate(workItem.Id);
                    promises.push(repository.UpdateWorkItem(wijson, workItem.Id));
                }
            }
        });
    }

    processWorkItems(sprint.RawWits, needSave);

    _witToSave = [];
    if (promises.length > 0) {
        Promise.all(promises)
            .then(() => { 
                clearWitInUpdate(); 
                repository.LoadWorkItems() 
            })
            .catch((reason) => {
                failToCallVss(reason, true) 
                clearWitInUpdate(); 
                repository.LoadWorkItems() 
            });
            
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

function failToCallVss(reason, shouldNotPauseAutoRefresh) {
    
    if (shouldNotPauseAutoRefresh != true) PauseAutoRefresh();
    
    alertUser(failure, reason);
}

function alertUser(msg, e){
    
    if (!msg){
        msg = e?.serverError?.value?.Message || e?.message || "Unknown error";
    }

    var logMsg = "Alert User: [" + msg + "]";
    
    if (
            !(e?.message?.indexOf('Rule Error') > 0) // don't log "rule validation" errors
            && !(e?.message?.indexOf('Status code 0:') > 0) //don't log "server unavailable" errors
        )
    {
        console.error(logMsg, e);
    }else{
        console.log(logMsg, e);
    }
    if (showFailAlerts){
        if (!(e?.message?.indexOf('Status code 0:') > 0)){
            alert(msg);
        }
    }
}

BuildDropPlan();


