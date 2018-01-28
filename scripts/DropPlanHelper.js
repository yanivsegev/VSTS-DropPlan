var colWidth = 180;
var sprint, container;
var nameById = [];
var _witToSave = [];
var _witInUpdate = [];
var _viewByTasks = true;

var _today = new Date(new Date().yyyy_mm_dd());

window.addEventListener("message", receiveMessage, false);

function receiveMessage(event) {
    try {
        var result = JSON.parse(event.data);
        if (result.result.fields) {
            console.log("Refresh.");
            queryAndRenderWit();
        }

    } catch (error) {

    }
}


function switchViewByTasks(viewByTasks){
    _viewByTasks = viewByTasks;
    $("#resetTasksBtn").attr("disabled", !viewByTasks);
    processWorkItems(sprint.RawWits, false);
}

function getColumns() {
    var columnArray = new Array();
    columnArray.push({ text: "", date: "", index: 0 });
    
    for (var colIndex = 0; colIndex < sprint.Dates.length; colIndex++) {

        columnArray.push({ 
            date: sprint.Dates[colIndex].ConvertGMTToServerTimeZone(), 
            index: colIndex + 1 });
    }
    return columnArray;
}

function render(isSaving, data, cols) {
    console.log("Rendering. (" + (performance.now() - t0) + " ms.) ");
    
    var result = "<table id='tasksTable' class='mainTable' cellpadding='0' cellspacing='0'><thead><tr>";
    result = result + "<td class='locked_class_name'><div class='taskColumn assignToColumn rowHeaderSpace'><button class='refreshPlanBtn' onclick='refreshPlan();'>Refresh Plan</button></div></td>"

    for (var colIndex = 1; colIndex < cols.length; colIndex++) {
        result = result + "<td class='column_class_name'><div class='taskColumn taskHeader' style='width:" + colWidth + "px'>" + 
                            VSS.Core.convertValueToDisplayString(cols[colIndex].date, "dddd") + "<br>";

        if (debug_mode) {
            result = result + VSS.Core.convertValueToDisplayString(cols[colIndex].date, "u") + "</div></td>";           
        } 
        else{
            result = result + VSS.Core.convertValueToDisplayString(cols[colIndex].date, "d") + "</div></td>";            
        }


        
                            
    }
    result = result + "</tr><tbody>"
 
    for (var nameIndex = 0; nameIndex < data.length; nameIndex++) {
        var personRow = data[nameIndex];

        if (personRow.hasItems){

            result = result + "<tr class='taskTr taskTrSpace'><td class='row_class_name'><div class='rowHeaderSpace'/></td><td colspan='" + (sprint.Dates.length) + "'/></tr>";
            result = result + "<tr class='taskTr taskTrContent' >";

            if (personRow.assignedTo) {

                result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='rowHeader'>";
                var avatar = getMemberImage(personRow.assignedTo);
                if (avatar) {
                    result = result +  "<img class='assignedToAvatar' src='" + avatar + "'/>"
                }
                result = result + "<div class='assignedToName'>" + personRow.assignedTo + "</div>"

                if (personRow.TotalCapacity > 0) {
                    var cssClass = 'visual-progress-total visual-progress-overallocated';
                    var cssClassOut = 'visual-progress-current visual-progress-overallocated';
                    var precent = 0;
                    if (personRow.TatalTasks > 0){
                        precent = personRow.TotalCapacity / personRow.TatalTasks * 100;
                    }
                    if (personRow.TotalCapacity >= personRow.TatalTasks) {
                        cssClass = ' visual-progress-underallocated';
                        cssClassOut = 'visual-progress-total visual-progress-current visual-progress-total-unallocated';
                        precent = personRow.TatalTasks / personRow.TotalCapacity * 100;
                    }

                    result = result + "<div class='visual-progress-top-container'><div class='visual-progress-container'><div class='" + cssClassOut + "' style='width: 100%;'><div class='" + cssClass + "' style='width: " + precent + "%;'></div></div></div><div class='progress-text'>(" + personRow.TatalTasks + " of " + personRow.TotalCapacity + "h)</div></div></div></td>";
                }
            } else {
                result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='rowHeader'><div class='assignedToName'>Unassigned</div></div></td>";
            }

            for (var dateIndex = 0; dateIndex < sprint.Dates.length; dateIndex++) {
                var date = sprint.Dates[dateIndex].yyyymmdd();
                var day = sprint.Dates[dateIndex].getDay();
                personDateCell = personRow[date];
                result = result + "<td class='taskTd ";
                if (isDayOff(personRow.assignedTo, date, day)) result = result + "taskDayOff "
                if (date == _today.yyyymmdd()) result = result + "taskToday "

                result = result + "'>";

                if (debug_mode) result = result + date;

                for (var taskIndex = 0; taskIndex < (personDateCell.MaxDataRow || 0); taskIndex++) {
                    var task = personDateCell[taskIndex];
                    result = result + "<div class='taskDiv'>";

                    if (task.Type == 1 && task.part == 0) {
                        var parentId = null;
                        var parentWit = null;
                        var partnerWorktemId = null;
                        result = result + "<div witId=" + task.workItem.Id;
                        
                        if (task.isWitTask){
                            parentId = task.workItem.GetParentId();
                            parentWit = sprint.GetWorkitemById(parentId);
                            partnerWorktemId = sprint.Wits.indexOf(parentWit);
                            result = result + " witParentId=" + parentId + " class='task tooltip ";
                        }else{
                            result = result + " class='task ";
                        }

                        if (task.endDate < _today) result = result + "taskOverDue "

                        if (isSaving && isWitInUpdate(task.workItem.Id)) result = result + "taskSaving "

                        switch (task.workItem.Blocked) {
                            case "Yes": result = result + "taskBlocked "; break;
                        }

                        switch (task.workItem.State) {
                            case "Done": result = result + "taskDone "; break;
                            case "Closed": result = result + "taskDone "; break;
                        }

                        
                        if (task.isWitTask){
                            result = result + " taskStart";
                        }else{
                            result = result + " PBItaskStart";
                        }

                        result = result + " taskAreaPath" + task.areaPath.id + " ";

                        result = result + "' style='width:" + (colWidth * task.total - 26) + "px;";

                        var title = task.workItem.Title;
                        var desc = task.workItem.Description;
                        try {
                            if (desc && desc.includes("DropPlanJson ")) {
                                var decodeDesc = $("<div>" + desc + "</div>")[0].innerText;
                                var json = JSON.parse(decodeDesc.substring(decodeDesc.indexOf("DropPlanJson ") + 13));
                                if (json.img) {
                                    result = result + "background-image: url(" + json.img + "); background-size:100% 100%;";
                                }
                                if (json.showTitle == "0") {
                                    title = "";
                                }
                            }
                        } catch (error) { }

                        result = result + "'>";

                        if (task.isWitTask){

                            var tooltiptextcls = 'tooltiptextPBI';
                            if (parentWit) {
                                if (parentWit.WorkItemType == "Bug") {
                                    tooltiptextcls = 'tooltiptextBUG';
                                }
                            }
                            if (parentId != -1) {
                                result = result + "<div class='tooltiptext " + tooltiptextcls + "' witId=" + parentId + ">";
                                if (parentWit) {
                                    result = result + "<div class='taskTitle pbiText'><div class='openWit'>" + parentWit.Title + "</div><div class='pbiState'>" + parentWit.State + "</div></div>";
                                } else {
                                    result = result + "<div class='taskTitle pbiText'><div class='openWit'>Open PBI</div></div>";
                                }
                                result = result + "</div>";
                            }
                        }

                        result = result + "<div class='taskTitle'><div class='openWit'>" + title + "</div></div>";
                        
                        if (task.isWitTask){
                            
                            var remain = task.workItem.RemainingWork;
                            if (remain != "") result = result + "<div class='taskRemainingWork'>" + remain + "</div>";

                        }

                        result = result + "</div>";
                    }

                    result = result + "</div>";

                }
                result = result + "</td>";
            }
            result = result + "</tr>";
        }
    }

    result = result + "</tbody></table>";
    container.innerHTML = result;
}

function getCapacity(name) {
    var result = 0;
    $.each(_teamMemberCapacities, function (index, value) {
        if (value.teamMember.displayName == name) {
            if (value.activities.length > 0 && value.activities[0].capacityPerDay > 0) {
                result = value.activities[0].capacityPerDay || 6;
            }
        }
    });
    return result;
}
function getDefaultDaysPerTask(remainingWork, capacity) {
    return Math.ceil(remainingWork / capacity) - 1;
}

function isDayOff(name, date, day) {
    var dayOff = false;
    $.each(_teamMemberCapacities, function (index, value) {
        if (value.teamMember.displayName == name) {
            if (isDayInRange(value.daysOff, date)) dayOff = true;
        }
    });

    if (isDayInRange(_daysOff.daysOff, date)) dayOff = true;

    if ($.inArray(day, _teamSettings.workingDays) == -1) dayOff = true;

    return dayOff;
}

function getMemberImage(name) {
    var img = "";
    $.each(_teamMemberCapacities, function (index, value) {
        if (value.teamMember.displayName == name) img = value.teamMember.imageUrl;
    });
    return img;
}

function ResetRelations() {
    $(".sameParent").removeClass("sameParent");

    var can1 = document.getElementById('canvas2');
    var ctx1 = can1.getContext('2d');
    can1.style.opacity = 0;
    clearRelationsInternal(ctx1, can1);
}

function DrawRelations(current) {
    var can1 = document.getElementById('canvas2');
    var ctx1 = can1.getContext('2d');
    var fillStyle = "gray";

    if (!current.find(".taskTitle").hasClass('noclick')) {
        var witParentId = current.attr("witParentId");
        if (witParentId != -1) {
            $("div[witParentId=" + witParentId + "]").each(function (x, other) {
                if (!current.is(other)) {
                    $(other).addClass("sameParent");
                    can1.style.opacity = 1;
                    drawArrow(ctx1, can1, $(current), $(other), fillStyle, false);
                }
            });
        }
    }
}

function AlignTitlesToView() {
    $(".taskTitle").each(function (i, elm) {

        var offset = 0 - ($(elm).offset().left - 100 - $(window).scrollLeft());
        var title = $(elm).find(".openWit");
        if (offset > 0) {
            title.css("margin-left", (offset) + "px");
        } else {
            title.css("margin-left", "0px");
        }
        return true;
    })
}

function attachEvents() {
    console.log("Attach events")
    $(".taskStart").hover(function (In) {
        if (!$(".activeTask")[0]) {
            var current = $(In.target).closest(".taskStart");
            DrawRelations(current);
        }
    },
        function (Out) {
            if (!$(".activeTask")[0]) {
                ResetRelations();
            }
        });


    $("body").click(function () {
        ResetRelations();
        $(".activeTask").removeClass("activeTask");
    });


    $(".taskStart").click(function (event) {
        event.stopPropagation();
        ResetRelations();
        $(this).toggleClass("activeTask");
        $(".activeTask").not($(this)).removeClass("activeTask");
        if ($(this).hasClass("activeTask")) {
            DrawRelations($(this));
        }
    });

    $(window).scroll(function () {
        AlignTitlesToView();
    });

    $(".openWit").click(function (event) {
        event.stopPropagation();
        var witId = $(this).parent().parent().attr("witId");

        if ($(this).parent().hasClass('noclick')) {
            $(this).parent().removeClass('noclick');
        }
        else {
            _witServices.WorkItemFormNavigationService.getService().then(function (workItemNavSvc) {
                workItemNavSvc.openWorkItem(witId);
            });
        }
    });

    $(".taskStart:not(.taskSaving)").draggable(({
        opacity: 0.7,
        containment: ".mainTable",
        cancel: ".taskChanged",
        start: function (event, ui) {
            SetNoClick(this);
        },
        stop: function (event, ui) {
            var changeDays = (Math.round((ui.position.left - ui.originalPosition.left) / colWidth));
            var witId = ui.helper.attr("witId");
            updateWorkItemDates(witId, changeDays, changeDays);
            updateWorkItemInVSS();
        }
    }));

    $(".taskTrContent").droppable({
        drop: function (event, ui) {
            var assignedTo = nameById[$(this).closest('tr')[0].cells[0].attributes["assignedtoid"].value].Name;
            var witId = ui.draggable.attr("witId");
            updateWorkItemAssignTo(witId, assignedTo);
        }
    });


    $(".taskStart:not(.taskSaving)").resizable({
        grid: colWidth,
        containment: ".mainTable",
        minWidth: 60,
        handles: 'e',
        cancel: ".taskChanged",
        stop: function (event, ui) {
            var witId = ui.element.attr("witId");
            var changeDays = (Math.round((ui.size.width - ui.originalSize.width) / colWidth));
            updateWorkItemDates(witId, 0, changeDays);
            updateWorkItemInVSS();
        },
        start: function (event, ui) {
            SetNoClick(this);
        },
    });
}

function SetNoClick(obj) {
    $(".sameParent").removeClass("sameParent");
    $(obj).find(".taskTitle").addClass('noclick');
    clearRelations();
    $(obj).addClass("taskChanged");
}


function updateWorkItemDates(witId, changeStartDays, changeEndDays) {
    
    if (changeStartDays != 0 || changeEndDays != 0) {
        
        var workItem = sprint.GetWorkitemById(witId);
        if (workItem.StartDate) {
        
            workItem.StartDate = workItem.StartDate.addDays(changeStartDays);

            workItem.FinishDate = workItem.FinishDate.addDays(changeEndDays);

            pushWitToSave(witId);
        }
    }
}

function updateWorkItemAssignTo(witId, assignedTo) {
    var workItem = sprint.GetWorkitemById(witId);
    
    if (workItem.AssignedTo != assignedTo) {
        workItem.AssignedTo = assignedTo;
        pushWitToSave(witId);
    }
}

function getTable() {

    var result = new Array();
    var names = {};
    var areaPaths = {};
    var areaPathsId = 1;
    var globalDates = sprint.Dates;
    
    for (var i = 0; i < sprint.Wits.length; i++) {
        var workItem = sprint.Wits[i];
        var personRow;
        
        if (!names[workItem.AssignedTo]) {
            names[workItem.AssignedTo] = { id: result.length, days: [] };
            var newName = { 
                Name: workItem.AssignedTo, 
                Capacity: getCapacity(workItem.AssignedTo), 
                TotalCapacity: 0, 
                TatalTasks: 0,
                assignedTo: workItem.AssignedTo, 
                assignedToId: result.length,
                hasItems: false,
            };
            for (var colIndex = 0; colIndex < globalDates.length; colIndex++) {
                var currentDate = globalDates[colIndex];
                newName[currentDate.yyyymmdd()] = [];
                if (currentDate >= _today && !isDayOff(workItem.AssignedTo, currentDate.yyyymmdd(), currentDate.getDay())) {
                    newName.TotalCapacity = newName.TotalCapacity + newName.Capacity;
                }
            }
            
            result.push(newName);
            nameById[names[workItem.AssignedTo].id] = { Name: workItem.AssignedTo };
        }

        personRow = result[names[workItem.AssignedTo].id];
       
        var remainingWork = 0;
        
        if (workItem.isTaskWit) {
            
            remainingWork = workItem.RemainingWork;
            personRow.TatalTasks = personRow.TatalTasks + remainingWork;
        }

        if ((!_viewByTasks && workItem.isPBIWit) || (_viewByTasks && workItem.isTaskWit)){
            if (!areaPaths[workItem.AreaPath]) {
                areaPaths[workItem.AreaPath] = { id: areaPathsId };
                areaPathsId = areaPathsId + 1;
            }
           
            personRow.hasItems = true;
            
            var isWitTask;
           

            if (_viewByTasks && workItem.isTaskWit) {
                
                isWitTask = true;
                var capacity = personRow.Capacity;
                var witChanged = false;
                
                if (!workItem.StartDate) {
                    witChanged = true;
                    globalDates.forEach(function (item, index) {
                        var tasksPerDay = names[workItem.AssignedTo].days[item.yyyymmdd()] || 0;
                        if ((tasksPerDay < capacity || capacity == 0) && !workItem.StartDate && !isDayOff(workItem.AssignedTo, item.yyyymmdd(), item.getDay()) && (item >= _today)) {
                            workItem.StartDate = item;
                        }
                    });

                    if (!workItem.StartDate) {
                        workItem.StartDate = sprint.EndDate;
                    }
                }

                if (!workItem.FinishDate) {
                    witChanged = true;
                    var remainingWorkLeft = remainingWork;
                    var dates = getDates(workItem.StartDate, sprint.EndDate);
                    dates.forEach(function (item, index) {
                        var tasksPerDay = names[workItem.AssignedTo].days[item.yyyymmdd()] || 0;

                        if ((tasksPerDay < capacity || capacity == 0) && !isDayOff(workItem.AssignedTo, item.yyyymmdd(), item.getDay()) && !workItem.FinishDate) {

                            var todayPart = remainingWorkLeft;
                            if (tasksPerDay + todayPart > capacity && capacity > 0) {
                                todayPart = capacity - tasksPerDay;
                            }
                            remainingWorkLeft = remainingWorkLeft - todayPart;

                            if (remainingWorkLeft == 0) {
                                workItem.FinishDate = item;
                            }
                        }
                    });


                    if (!workItem.FinishDate) {
                        workItem.FinishDate = sprint.EndDate;
                    }

                }

                if (witChanged) {
                    pushWitToSave(workItem.Id);
                }

            }
            
            if (!_viewByTasks && workItem.isPBIWit) 
            {
                isWitTask = false;
                workItem.StartDate = sprint.EndDate;
                workItem.FinishDate = sprint.StartDate;

                if (workItem.Relations) {
                    workItem.Relations.forEach(function (item, index) {
                        if (item.rel == "System.LinkTypes.Hierarchy-Forward") {
                            var childId = item.url.substring(item.url.lastIndexOf("/") + 1);
                            var childWit = sprint.GetWorkitemById(childId);
                            if (childWit) {

                                if (childWit.Blocked == "Yes"){
                                    workItem.Blocked = childWit.Blocked;
                                }

                                var ds = childWit.StartDate;
                                var de = childWit.FinishDate;

                                if (workItem.StartDate > ds) {
                                    workItem.StartDate = ds;
                                }

                                if (workItem.FinishDate < de) {
                                    workItem.FinishDate = de;
                                }
                            }
                        }
                    });
                }
               
            }

            if (workItem.StartDate < sprint.StartDate) workItem.StartDate = sprint.StartDate;
            if (workItem.StartDate > sprint.EndDate) workItem.StartDate = sprint.EndDate;
            if (workItem.FinishDate > sprint.EndDate) workItem.FinishDate = sprint.EndDate;
            if (workItem.FinishDate < workItem.StartDate) workItem.FinishDate = workItem.StartDate;

            var dates = getDates(workItem.StartDate, workItem.FinishDate);

            var selectedRow = -1;
            var found = false;
            while (!found) {
                found = true;
                selectedRow = selectedRow + 1;
                for (var colIndex = 0; colIndex < dates.length; colIndex++) {
                    var date = dates[colIndex].yyyymmdd();
                    if (personRow[date].length > selectedRow) {
                        if (personRow[date][selectedRow].Type != 0) {
                            found = false;
                        }
                    }
                }
            }

            for (var colIndex = 0; colIndex < dates.length; colIndex++) {
                var date = dates[colIndex].yyyymmdd();
                personDateCell = personRow[date];
                
                while (selectedRow >= personDateCell.length) personDateCell.push({ Type: 0 });
                
                if (!isDayOff(workItem.AssignedTo, dates[colIndex].yyyymmdd(), dates[colIndex].getDay())) {
                    var todayTasks = (names[workItem.AssignedTo].days[date] || 0);
                    var todayPart = remainingWork;
                    if (todayTasks + remainingWork > capacity) {
                        todayPart = capacity - todayTasks;
                    }
                    remainingWork = remainingWork - todayPart;
                    names[workItem.AssignedTo].days[date] = todayTasks + todayPart;
                }

                if (colIndex == 0) {
                    personDateCell.MaxDataRow = personDateCell.length;
                }

                personDateCell[selectedRow] = { 
                    Type: 1, 
                    part: colIndex, 
                    total: dates.length, 
                    workItem: workItem, 
                    id: i, 
                    endDate: dates[dates.length - 1], 
                    areaPath: areaPaths[workItem.AreaPath],
                    isWitTask: isWitTask
                };
            }
        }
    }

    return result.sort(function (a, b) { return a.assignedTo.localeCompare(b.assignedTo) });
}