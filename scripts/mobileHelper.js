function renderSummary(data){

    var result = "<div class='summary'>"

    var personRow = getCurrentUserData(data);
    
    if (personRow && personRow.hasItems){

        for (var dateIndex = 0; dateIndex < sprint.Dates.length; dateIndex++) {
            var date = sprint.Dates[dateIndex].yyyymmdd();
            personDateCell = personRow[date];
            var dayIsEmpty = true;

            var tasks = getTasks(personDateCell)
            
            if (tasks != ""){

                result = result + "<div class='summaryDay'>"

                var date = sprint.Dates[dateIndex].ConvertGMTToServerTimeZone();
                result = result + "<div class='summaryDayTitle'>" + VSS.Core.convertValueToDisplayString(date, "dddd") + " - ";
                result = result + VSS.Core.convertValueToDisplayString(date, "d") + "</div>";            

                result = result + tasks + "</div>"
            }
        }
    }
    else
    {
        result = result + NothingToDo();
    }

    result = result + "</div>";
    var container = document.getElementById("grid-container");
    container.innerHTML = result;
}

function NothingToDo(){
    return "<div> Nothing left to do here! </div>"
}

function getCurrentUserData(data){
    for (var nameIndex = 0; nameIndex < data.length; nameIndex++) {
        currentPersonRow = data[nameIndex];

        if (currentPersonRow.isCurrenctUser) { return currentPersonRow; }
    }
    return undefined;
}

function getTasks(personDateCell){
    var result = "";
    for (var taskIndex = 0; taskIndex < (personDateCell.MaxDataRow || 0); taskIndex++) {
        var task = personDateCell[taskIndex];
        //var showTask = task.isOverDue || task.isBlocked;

        result = result + "<div witId=" + task.workItem.Id + " class='summaryTask'> <div class='summaryTaskIcon ";
            
        switch (task.workItem.State) {
            case "Done": result = result + "taskDone "; break;
            case "Closed": result = result + "taskDone "; break;
        }

            
            
        result = result + "'>&nbsp</div> <div class='summaryTaskTitle'>" + task.workItem.Title + "</div>";
        
        if (task.isWitTask){
            
            var remain = task.workItem.RemainingWork;
            if (remain != "") result = result + "<div class='summaryTaskRemainingWork'>" + remain + "</div>";

        }

        result = result + "</div>";
    }
    return result
}


function buildSummery(){
    console.log("Stating.");

    VSS.init({
        explicitNotifyLoaded: true,
        usePlatformScripts: false,
        usePlatformStyles: true
    });

        

    VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient"],

    function (VSS_Service, TFS_Wit_WebApi) {
        VSS.ready(function () {
    
            var query = 'SELECT [System.Id], [System.Title], [System.State],[Microsoft.VSTS.Scheduling.StartDate], [Microsoft.VSTS.Scheduling.FinishDate]';
            query = query + 'FROM workitems WHERE [Microsoft.VSTS.Scheduling.StartDate] < @today + 7 AND [Microsoft.VSTS.Scheduling.FinishDate] > @today - 7';
            query = query + 'AND [System.AssignedTo] = @me ORDER BY [System.Id]';
        

            var WitClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);
            WitClient.queryByWiql({query: query}).then(
                function (result) {


                    var openWorkItems = result.workItems.map(function (wi) { return wi.id });

                    var start = 0;
                    var end = 0;
                    var getWorkItemsPromises = [];
                    while (end < openWorkItems.length) {
                        end = start + 200;
                        getWorkItemsPromises.push(WitClient.getWorkItems(openWorkItems.slice(start, end), undefined, undefined, 1));
                        start = end;
                    }
                    Promise.all(getWorkItemsPromises).then(function (x) { renderQuickSummary(x.workItems); });

                    
            });

            VSS.register(VSS.getContribution().id, {});
            VSS.notifyLoadSucceeded();
            console.log("VSS init.");
        });
    });

}

function renderQuickSummary(data){
debugger;
    var result = "<div class='summary'>"

    if (data.length > 0){

        for (var dateIndex = 0; dateIndex < data.length; dateIndex++) {
            
            
            var tasks = getTasks(personDateCell)
            
            if (tasks != ""){

                result = result + "<div class='summaryDay'>"

                var date = sprint.Dates[dateIndex].ConvertGMTToServerTimeZone();
                result = result + "<div class='summaryDayTitle'>" + VSS.Core.convertValueToDisplayString(date, "dddd") + " - ";
                result = result + VSS.Core.convertValueToDisplayString(date, "d") + "</div>";            

                result = result + tasks + "</div>"
            }
        }
    }
    else
    {
        result = result + NothingToDo();
    }

    result = result + "</div>";
    var container = document.getElementById("grid-container");
    container.innerHTML = result;
}

function getQuickTasks(task){
    result = result + "<div witId=" + task.Id + " class='summaryTask'> <div class='summaryTaskIcon ";
            
    switch (task.fields["System.State"]) {
        case "Done": result = result + "taskDone "; break;
        case "Closed": result = result + "taskDone "; break;
    }

        
    result = result + "'>&nbsp</div> <div class='summaryTaskTitle'>" + task.fields["System.Title"] + "</div>";

    var remain = task.fields["Microsoft.VSTS.Scheduling.RemainingWork"] || 0;
    if (remain != "") result = result + "<div class='summaryTaskRemainingWork'>" + remain + "</div>";


    result = result + "</div>";

    return result;
}