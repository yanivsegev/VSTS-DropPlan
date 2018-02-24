var repository = new VSSRepository();
    
var sprint, container;
var _scrollToToday = true;

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event) {
    try {
        var result = JSON.parse(event.data);
        if (result.result.fields) {
            console.log("Refresh.");
            repository.LoadWorkItems();
        }

    } catch (error) {

    }
}

function switchViewByTasks(viewByTasks){
    sprint.ViewByTasks = viewByTasks;
    $("#resetTasksBtn").attr("disabled", !viewByTasks);
    processWorkItems(sprint.RawWits, false);
}


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

    repository.reportProgress = reportProgress;
    repository.reportFailure = reportFailure;
    repository.failToCallVss = failToCallVss;
    repository.WorkItemsLoaded = WorkItemsLoaded;
    repository.Init();

}

function WorkItemsLoaded(workItems){
    processWorkItems(workItems, false);
}

function refreshPlan() {
    $("#refreshPlanBtn").css('opacity', '0');
    repository.LoadWorkItems();
}


function processWorkItems(workItems, isSaving) {
    var viewByTasks = true;
    if (sprint) viewByTasks = sprint.ViewByTasks;
    
    sprint = new SprintData(workItems, repository, viewByTasks);
    
    container = document.getElementById("grid-container");;

    var data = sprint.GetData();
    
    dettachEvents();

    render(isSaving, data);

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
                promises.push(repository.UpdateWorkItem(wijson, workItem.Id));
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
            repository.LoadWorkItems();
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

