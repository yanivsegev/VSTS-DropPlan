var colWidth = 180;
var workItems, startDate, endDate, container;
var nameById = [];

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
    workItems = IworkItems;
    startDate = IstartDate.getGMT();
    endDate = IendDate.getGMT();
    container = Icontainer;
}

function process(isGMT){
    var cols = getColumns(startDate, endDate);
    

    var result = "<table id='tasksTable' class='mainTable' cellpadding='0' cellspacing='0'><thead><tr>";
    result = result + "<th><div class='taskColumn assignToColumn'></div></th>"
    
    for (var colIndex = 1; colIndex < cols.length; colIndex++){
        result = result + "<th><div class='taskColumn' style='width:" + colWidth + "px'>" +  cols[colIndex].text + "<br>" + cols[colIndex].date + "</div></th>";
    }
    result = result + "</tr><tbody>"

    var data = getTable(workItems , startDate, endDate, isGMT);
    var dates = getDates(startDate, endDate);
            
    for (var nameIndex = 0; nameIndex < data.length; nameIndex++){
        var personRow = data[nameIndex];
        
        result = result + "<tr class='taskTr taskTrSpace'><td colspan='" + (dates.length + 1) + "'/></tr>";
        result = result + "<tr class='taskTr taskTrContent' >";
        
        if (personRow.assignedTo){
            result = result + "<td assignedToId=" + personRow.assignedToId + "><img class='assignedToAvatar' src='" + getMemberImage(personRow.assignedTo) + "'/><div class='assignedToName'>" +  personRow.assignedTo + "</div></td>";
        } else {
            result = result + "<td assignedToId=" + personRow.assignedToId + "><div class='assignedToName'>Unassigned</div></td>";
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

                    var parentId;
                    task.workItem.relations.forEach(function(item,index) { 
                        if (item.rel == "System.LinkTypes.Hierarchy-Reverse"){
                            parentId = item.url.substring(item.url.lastIndexOf("/") + 1)
                        }
                    })

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

function getDefaultDaysPerTask(name, remainingWork){
    var result = 0;
    $.each(_teamMemberCapacities, function( index, value ) {
        if (value.teamMember.displayName == name ){
            if (value.activities.length > 0 && value.activities[0].capacityPerDay > 0)
            {
                result = Math.ceil(remainingWork / value.activities[0].capacityPerDay) - 1;
            }
        } 
    });
    return result;
}

function isDayOff(name, date, day){
    var dayOff = false;
    $.each(_teamMemberCapacities, function( index, value ) {
        if (value.teamMember.displayName == name ){
            if (isDayInRange(value.daysOff, date)) dayOff = true;
        } 
    });

    if (isDayInRange(_daysOff, date)) dayOff = true;

    $.each(_teamSettings.workingDays, function( index2, value3 ) {
        if (value3 == day) dayOff = true;
    });

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
        
        if (!names[assignedTo]) {
            names[assignedTo] = result.length + 1;
            var newName = {Name: assignedTo};
            for (var colIndex = 0; colIndex < globalDates.length; colIndex++){
                newName[globalDates[colIndex].yyyymmdd()] = [];
            }
            result.push(newName);
            nameById[names[assignedTo] - 1] =  {Name: assignedTo};
        }

        var personRow = result[names[assignedTo] - 1];
        personRow.assignedTo = assignedTo;
        personRow.assignedToId = names[assignedTo] - 1;

        var witStartDate = new Date(workItem.fields["Microsoft.VSTS.Scheduling.StartDate"] || startDate);
        if (!isGMT) witStartDate = witStartDate.getGMT();

        var witEndDate;

        if (!workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"])
        {
            witEndDate = witStartDate.addDays(getDefaultDaysPerTask(personRow.assignedTo, workItem.fields["Microsoft.VSTS.Scheduling.RemainingWork"]));
        }
        else
        {
            witEndDate = new Date(workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"] || startDate);
            if (!isGMT) witEndDate = witEndDate.getGMT();
        
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
                personDateCell = personRow[date];
                personDateCell[selectedRow] = {Type:1, part: colIndex, total: dates.length, workItem:workItem, id:i, endDate: dates[dates.length - 1]};
            }

        }
    } 
    return result.sort(function(a, b){return a.assignedTo.localeCompare(b.assignedTo)});
}