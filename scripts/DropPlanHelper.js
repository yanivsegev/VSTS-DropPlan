var colWidth = 180;
var workItems, startDate, endDate, container;
var nameById = [];
var _witToSave = [];

function getColumns(startDate, stopDate) {
    var columnArray = new Array();
    columnArray.push({ text: "", date:"", index: 0 });
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var dates = getDates(startDate, stopDate);

    for (var colIndex = 0; colIndex < dates.length; colIndex++){
        var day = dates[colIndex].getDay();
        columnArray.push({ text: days[day], date:dates[colIndex].mmdd(), index: colIndex+1 });
    }
    return columnArray;
}

function setData(Icontainer, IworkItems, IstartDate, IendDate){
    console.log("Setup items");
    workItems = IworkItems.sort(function (a, b) {
        
        if (a.fields["System.WorkItemType"] == 'Task' && 
            b.fields["System.WorkItemType"] == 'Task'){
            
            if (!a.fields["Microsoft.VSTS.Scheduling.StartDate"] && !b.fields["Microsoft.VSTS.Scheduling.StartDate"]){
                var parentIda = getParentId(a);
                var parentIdb = getParentId(b);
                var pa = null,pb = null;

                IworkItems.forEach(function(item,index) { 
                    if (item.id == parentIda) pa = item.fields["Microsoft.VSTS.Common.BacklogPriority"] || 0;
                    if (item.id == parentIdb) pb = item.fields["Microsoft.VSTS.Common.BacklogPriority"] || 0;
                });

                if ( (pa || 0) != 0 && (pb || 0) != 0 )
                {
                    return pa - pb;
                }
            } else if (!a.fields["Microsoft.VSTS.Scheduling.StartDate"] && b.fields["Microsoft.VSTS.Scheduling.StartDate"]) {
                return 1;
            } else if (a.fields["Microsoft.VSTS.Scheduling.StartDate"] && !b.fields["Microsoft.VSTS.Scheduling.StartDate"]) {
                return -1;
            } 


        }

        return a.id - b.id;
    });

    //workItems.forEach(function(item,index) { console.log(item.fields["System.WorkItemType"] + "(" + item.id + ")" + item.fields["System.Title"] + " " + item.fields["Microsoft.VSTS.Scheduling.StartDate"]) });

    startDate = IstartDate.getGMT();
    endDate = IendDate.getGMT();
    container = Icontainer;
}

function process(isGMT){
    var cols = getColumns(startDate, endDate);
    

    var result = "<table id='tasksTable' class='mainTable' cellpadding='0' cellspacing='0'><thead><tr>";
    result = result + "<td class='locked_class_name'><div class='taskColumn assignToColumn rowHeaderSpace'></div></td>"
    
    for (var colIndex = 1; colIndex < cols.length; colIndex++){
        result = result + "<td class='column_class_name'><div class='taskColumn' style='width:" + colWidth + "px'>" +  cols[colIndex].text + "<br>" + cols[colIndex].date + "</div></td>";
    }
    result = result + "</tr><tbody>"

    var data = getTable(workItems , startDate, endDate, isGMT);
    var dates = getDates(startDate, endDate);
            
    for (var nameIndex = 0; nameIndex < data.length; nameIndex++){
        var personRow = data[nameIndex];
        
        result = result + "<tr class='taskTr taskTrSpace'><td class='row_class_name'><div class='rowHeaderSpace'/></td><td colspan='" + (dates.length) + "'/></tr>";
        result = result + "<tr class='taskTr taskTrContent' >";
        
        if (personRow.assignedTo){
            result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='rowHeader'><img class='assignedToAvatar' src='" + getMemberImage(personRow.assignedTo) + "'/><div class='assignedToName'>" +  personRow.assignedTo + "</div></div></td>";
        } else {
            result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='rowHeader'><div class='assignedToName'>Unassigned</div></div></td>";
        }


        for (var dateIndex = 0; dateIndex < dates.length; dateIndex++){
            var date = dates[dateIndex].yyyymmdd();
            var day = dates[dateIndex].getDay();
            personDateCell = personRow[date];
            result = result + "<td class='taskTd'><div class='taskTdDiv ";
            if (isDayOff(personRow.assignedTo, date, day)) result = result + "taskDayOff "
            if (isToday(date)) result = result + "taskToday "
            
            result = result + "'>";
        
            for (var taskIndex = 0; taskIndex < personDateCell.length; taskIndex++){
                var task = personDateCell[taskIndex];
                
                result = result + "<div class='taskDiv'>";

                if (task.Type == 1 && task.part == 0){ 

                    var parentId = getParentId(task.workItem);

                    result = result + "<div witId=" + task.workItem.id + " workItemId=" + task.id + " witParentId=" + parentId + " class='task ";
                    
                    if (task.endDate < new Date(new Date().yyyy_mm_dd() )) result = result + "taskOverDue "
                    
                    switch(task.workItem.fields["Microsoft.VSTS.CMMI.Blocked"]) {
                        case "Yes": result = result + "taskBlocked "; break;
                    }
                    
                    switch(task.workItem.fields["System.State"]) {
                        case "Done": result = result + "taskDone "; break;
                    }

                    result = result + "taskStart "; 
                    
                    result = result + "' style='width:" + (colWidth * task.total - 26 )  + "px'>";
                    result = result + "<div class='taskTitle'>" + task.workItem.fields["System.Title"] + "</div>";
                    result = result + "<div class='taskRemainingWork'>" + (task.workItem.fields["Microsoft.VSTS.Scheduling.RemainingWork"] || "") + "</div>";
                    result = result + "</div>";     
                }
                
                result = result + "</div>";
                
            }
            result = result + "</div></td>";
        }    
        result = result + "</tr>";
    }

    result = result + "</tbody></table>";

    container.innerHTML = result;
}

function getParentId(workItem){
    var parentId;
    workItem.relations.forEach(function(item,index) { 
        if (item.rel == "System.LinkTypes.Hierarchy-Reverse"){
            parentId = item.url.substring(item.url.lastIndexOf("/") + 1)
        }
    })
    return parentId;
}

function getFirstAvailableDate(days, remainingWork, globalDates){
    return 0;
}


function getCapacity(name){
    var result = 6;
    $.each(_teamMemberCapacities, function( index, value ) {
        if (value.teamMember.displayName == name ){
            if (value.activities.length > 0 && value.activities[0].capacityPerDay > 0)
            {
                result = value.activities[0].capacityPerDay || 6;
            }
        } 
    });
    return result;
}
function getDefaultDaysPerTask(remainingWork, capacity){
     return Math.ceil(remainingWork / capacity) - 1;
}

function isDayOff(name, date, day){
    var dayOff = false;
    $.each(_teamMemberCapacities, function( index, value ) {
        if (value.teamMember.displayName == name ){
            if (isDayInRange(value.daysOff, date)) dayOff = true;
        } 
    });

    if (isDayInRange(_daysOff.daysOff, date)) dayOff = true;

    if (!_teamSettings.workingDays.includes(day)) dayOff = true;

    return dayOff;
}

function getMemberImage(name){
    var img = "";
    $.each(_teamMemberCapacities, function( index, value ) {
        if (value.teamMember.displayName == name ) img = value.teamMember.imageUrl;
    });
    return img;
}

function attachEvents(){

    $(".taskStart").hover(function(In) 
    {
        var current = $(In.target).closest(".taskStart");
        var witParentId = current.attr("witParentId");
        $("div[witParentId=" + witParentId + "]").each(function(x,other) {
            if (!current.is(other)) $(other).addClass("sameParent");
        });
    },
    function(Out) {
        $(".sameParent").removeClass("sameParent");
        var current = $(Out.target).closest(".taskStart");
    });


    $( ".taskTitle" ).click(function() {
        if ($(this).hasClass('noclick')) {
            $(this).removeClass('noclick');
        }
        else {
            var workItemId = $(this).parent().attr("workItemId");
            var workItem = workItems[workItemId];
        
            _witServices.WorkItemFormNavigationService.getService().then(function (workItemNavSvc) {
                workItemNavSvc.openWorkItem(workItem.id);
            });
        }
    });


    $( ".taskStart" ).draggable(({
        opacity: 0.7, 
        containment: ".mainTable", 
        start: function(event, ui) {
            $(this).find(".taskTitle").addClass('noclick');
            clearRelations();
        },
        stop: function( event, ui ) {
            var changeDays = (Math.round((ui.position.left - ui.originalPosition.left)/colWidth) );
            var workItemId = ui.helper.attr("workItemId");
            updateWorkItemDates(workItemId, changeDays, changeDays);
            updateWorkItemInVSS(workItemId);
        }
    }));

    $( ".taskTrContent" ).droppable({
        drop: function( event, ui ) {
            var assignedTo = nameById[$(this).closest('tr')[0].cells[0].attributes["assignedtoid"].value].Name;
            var workItemId = ui.draggable.attr("workItemId");
            updateWorkItemAssignTo(workItemId, assignedTo)
        }
    });

    
    $( ".taskStart" ).resizable({
        grid: colWidth,
        containment: ".mainTable",
        minWidth: 60,
        handles: 'e', 
        stop: function( event, ui ) { 
            var workItemId = ui.element.attr("workItemId");
            var changeDays = (Math.round((ui.size.width - ui.originalSize.width)/colWidth) );
            updateWorkItemDates(workItemId, 0, changeDays);
            updateWorkItemInVSS(workItemId);
        }, 
        start: function(event, ui) {
            $(this).find(".taskTitle").addClass('noclick');
            clearRelations();
        },
    }); 
}



function updateWorkItemDates(workItemId, changeStartDays, changeEndDays){
    var workItem = workItems[workItemId];
    
    workItem.fields["Microsoft.VSTS.Scheduling.StartDate"] = 
        new Date(workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]).addDays(changeStartDays).yyyy_mm_dd();

    workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"] = 
        new Date(workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"]).addDays(changeEndDays).yyyy_mm_dd();

 
}

function updateWorkItemAssignTo(workItemId, assignedTo){
    var workItem = workItems[workItemId];
    workItem.fields["System.AssignedTo"] = assignedTo;

}

function getTable(workItems, startDate, endDate, isGMT){

    var result = new Array();
    var names = {};
    var globalDates = getDates(startDate, endDate);
            
    for (var i = 0; i < workItems.length; i++){
        var workItem = workItems[i];
        var assignedTo = workItem.fields["System.AssignedTo"] || "";
        
        if (workItem.fields["System.WorkItemType"] == 'Task')
        {
            if (!names[assignedTo]) {
                names[assignedTo] = {id:result.length, days: []};
                var newName = {Name: assignedTo};
                for (var colIndex = 0; colIndex < globalDates.length; colIndex++){
                    newName[globalDates[colIndex].yyyymmdd()] = [];
                }
                result.push(newName);
                nameById[names[assignedTo].id] =  {Name: assignedTo};
            }

            var personRow = result[names[assignedTo].id];
            personRow.assignedTo = assignedTo;
            personRow.assignedToId = names[assignedTo].id;

            var witStartDate = null;
            var remainingWork = workItem.fields["Microsoft.VSTS.Scheduling.RemainingWork"];
            var capacity = getCapacity(name);
            var witChanged = false;

            if (!workItem.fields["Microsoft.VSTS.Scheduling.StartDate"])
            {
                witChanged = true;
                globalDates.forEach(function(item, index) {
                    var tasksPerDay = names[assignedTo].days[item.yyyymmdd()] || 0;
                    if (tasksPerDay < capacity && !witStartDate){
                        witStartDate = item.getGMT();
                    }
                });
                
                //witStartDate = startDate.addDays(getFirstAvailableDate(names[assignedTo].days, remainingWork, globalDates));
            }else{
                witStartDate = new Date(workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]);
            }
            
            if (!isGMT) witStartDate = witStartDate.getGMT();

            var witEndDate = null;

            if (!workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"])
            {
                witChanged = true;
                var remainingWorkLeft = remainingWork;
                var dates = getDates(witStartDate, endDate);
                dates.forEach(function(item, index) {
                    var tasksPerDay = names[assignedTo].days[item.yyyymmdd()] || 0;
                    if (tasksPerDay < capacity && !witEndDate){

                        var todayPart = remainingWorkLeft;
                        if (tasksPerDay + todayPart > capacity){
                            todayPart = capacity - tasksPerDay;
                        }
                        remainingWorkLeft = remainingWorkLeft - todayPart;

                        if (remainingWorkLeft == 0){
                            witEndDate = item.getGMT();
                        }
                    }
                });

            }
            else
            {
                witEndDate = new Date(workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"] || startDate);
                if (!isGMT) witEndDate = witEndDate.getGMT();
            
            }
            
            if (witChanged){
               _witToSave.push(i);
            }

            if (witStartDate < startDate) witStartDate = startDate;
            if (witEndDate > endDate) witEndDate = endDate;
            if (witEndDate < witStartDate) witEndDate = witStartDate;

            workItem.fields["Microsoft.VSTS.Scheduling.StartDate"] = witStartDate.yyyy_mm_dd();
            workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"] = witEndDate.yyyy_mm_dd();

    

            if (witStartDate >= startDate && witEndDate <= endDate)
            {
                var dates = getDates(witStartDate, witEndDate);

                var selectedRow = -1;
                var found = false;
                while(!found)
                {
                    found = true;
                    selectedRow = selectedRow + 1;
                    for (var colIndex = 0; colIndex < dates.length; colIndex++){
                        var date = dates[colIndex].yyyymmdd();
                        if (personRow[date].length > selectedRow){
                            if (personRow[date][selectedRow].Type != 0) {
                            found = false;
                            }
                        }
                    }    
                }

                for (var colIndex = 0; colIndex < globalDates.length; colIndex++){
                    var date = globalDates[colIndex].yyyymmdd();
                    personDateCell = personRow[date];
                    while(selectedRow >= personDateCell.length) personDateCell.push({Type:0});
                }

                for (var colIndex = 0; colIndex < dates.length; colIndex++){
                    var date = dates[colIndex].yyyymmdd();

                    var todayTasks = (names[assignedTo].days[date] || 0);
                    var todayPart = remainingWork;
                    if (todayTasks + remainingWork > capacity){
                        todayPart = capacity - todayTasks;
                    }
                    remainingWork = remainingWork - todayPart;
                    names[assignedTo].days[date] = todayTasks + todayPart;

                    personDateCell = personRow[date];
                    personDateCell[selectedRow] = {Type:1, part: colIndex, total: dates.length, workItem:workItem, id:i, endDate: dates[dates.length - 1]};
                }

            }
        }
    } 
    return result.sort(function(a, b){return a.assignedTo.localeCompare(b.assignedTo)});
}