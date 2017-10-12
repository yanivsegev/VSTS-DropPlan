var colWidth = 180;
var workItems, startDate, endDate, container;
var nameById = [];
var _witToSave = [];
var _witInUpdate = [];




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




function getColumns(startDate, stopDate) {
    var columnArray = new Array();
    columnArray.push({ text: "", date: "", index: 0 });
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var dates = getDates(startDate, stopDate);

    for (var colIndex = 0; colIndex < dates.length; colIndex++) {
        var day = dates[colIndex].getDay();
        columnArray.push({ text: days[day], date: dates[colIndex].toLocaleDateString(), index: colIndex + 1 });
    }
    return columnArray;
}

function setData(Icontainer, IworkItems, IstartDate, IendDate) {
    console.log("Setup items (" + (performance.now() - t0) + " ms.)");
    workItems = IworkItems.sort(function (a, b) {

        if (isTaskWit(a) && isTaskWit(b)) {

            if (!a.fields["Microsoft.VSTS.Scheduling.StartDate"] && !b.fields["Microsoft.VSTS.Scheduling.StartDate"]) {
                var parentIda = getParentId(a);
                var parentIdb = getParentId(b);
                var pa = null, pb = null;

                if (parentIda == parentIdb) {
                    pa = a.fields["Microsoft.VSTS.Common.BacklogPriority"] || 0;
                    pb = b.fields["Microsoft.VSTS.Common.BacklogPriority"] || 0;
                } else {
                    IworkItems.forEach(function (item, index) {
                        if (item.id == parentIda) pa = item.fields["Microsoft.VSTS.Common.BacklogPriority"] || 0;
                        if (item.id == parentIdb) pb = item.fields["Microsoft.VSTS.Common.BacklogPriority"] || 0;
                    });
                }

                if ((pa || 0) != 0 && (pb || 0) != 0) {
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


    startDate = IstartDate.getGMT();
    endDate = IendDate.getGMT();
    container = Icontainer;
}

function process(isGMT, isSaving) {
    console.log("Rendering. (" + (performance.now() - t0) + " ms.)");
    var cols = getColumns(startDate, endDate);


    var result = "<table id='tasksTable' class='mainTable' cellpadding='0' cellspacing='0'><thead><tr>";
    result = result + "<td class='locked_class_name'><div class='taskColumn assignToColumn rowHeaderSpace'><button class='refreshPlanBtn' onclick='refreshPlan();'>Refresh Plan</button></div></td>"

    for (var colIndex = 1; colIndex < cols.length; colIndex++) {
        result = result + "<td class='column_class_name'><div class='taskColumn' style='width:" + colWidth + "px'>" + cols[colIndex].text + "<br>" + cols[colIndex].date + "</div></td>";
    }
    result = result + "</tr><tbody>"

    var data = getTable(workItems, startDate, endDate, isGMT);
    var dates = getDates(startDate, endDate);

    for (var nameIndex = 0; nameIndex < data.length; nameIndex++) {
        var personRow = data[nameIndex];

        result = result + "<tr class='taskTr taskTrSpace'><td class='row_class_name'><div class='rowHeaderSpace'/></td><td colspan='" + (dates.length) + "'/></tr>";
        result = result + "<tr class='taskTr taskTrContent' >";

        if (personRow.assignedTo) {

            result = result + "<td class='row_class_name' assignedToId=" + personRow.assignedToId + "><div class='rowHeader'><img class='assignedToAvatar' src='" + getMemberImage(personRow.assignedTo) + "'/><div class='assignedToName'>" + personRow.assignedTo + "</div>"

            if (personRow.TotalCapacity > 0 && personRow.TatalTasks > 0) {
                var cssClass = 'visual-progress-total visual-progress-overallocated';
                var cssClassOut = 'visual-progress-current visual-progress-overallocated';
                var precent = personRow.TotalCapacity / personRow.TatalTasks * 100;
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

        for (var dateIndex = 0; dateIndex < dates.length; dateIndex++) {
            var date = dates[dateIndex].yyyymmdd();
            var day = dates[dateIndex].getDay();
            personDateCell = personRow[date];
            result = result + "<td class='taskTd'><div class='taskTdDiv ";
            if (isDayOff(personRow.assignedTo, date, day)) result = result + "taskDayOff "
            if (isToday(date)) result = result + "taskToday "

            result = result + "'>";

            for (var taskIndex = 0; taskIndex < personDateCell.length; taskIndex++) {
                var task = personDateCell[taskIndex];
                result = result + "<div class='taskDiv'>";

                if (task.Type == 1 && task.part == 0) {
                    var parentId = getParentId(task.workItem);
                    var parentWit = jQuery.grep(workItems, function (element) { return element.id == parentId; })[0];
                    var partnerWorktemId = workItems.indexOf(parentWit);
                    result = result + "<div witId=" + task.workItem.id + " workItemId=" + task.id + " witParentId=" + parentId + " class='task tooltip ";

                    if (task.endDate < new Date(new Date().yyyy_mm_dd())) result = result + "taskOverDue "

                    if (isSaving && isWitInUpdate(task.workItem.id)) result = result + "taskSaving "

                    switch (task.workItem.fields["Microsoft.VSTS.CMMI.Blocked"]) {
                        case "Yes": result = result + "taskBlocked "; break;
                    }

                    switch (task.workItem.fields["System.State"]) {
                        case "Done": result = result + "taskDone "; break;
                        case "Closed": result = result + "taskDone "; break;
                    }

                    result = result + "taskStart taskAreaPath" + task.areaPath.id + " ";

                    result = result + "' style='width:" + (colWidth * task.total - 26) + "px;";

                    var title = task.workItem.fields["System.Title"];
                    var desc = task.workItem.fields["System.Description"];
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

                    var tooltiptextcls = 'tooltiptextPBI';
                    if (parentWit) {
                        if (parentWit.fields["System.WorkItemType"] == "Bug") {
                            tooltiptextcls = 'tooltiptextBUG';
                        }
                    }
                    if (parentId != -1) {
                        result = result + "<div class='tooltiptext " + tooltiptextcls + "' witId=" + parentId + " workItemId=" + partnerWorktemId + ">";
                        if (parentWit) {
                            result = result + "<div class='taskTitle pbiText'><div class='openWit'>" + parentWit.fields["System.Title"] + "</div><div class='pbiState'>" + parentWit.fields["System.State"] + "</div></div>";
                        } else {
                            result = result + "<div class='taskTitle pbiText'><div class='openWit'>Open PBI</div></div>";
                        }
                        result = result + "</div>";
                    }

                    result = result + "<div class='taskTitle'><div class='openWit'>" + title + "</div></div>";

                    var remain = (task.workItem.fields["Microsoft.VSTS.Scheduling.RemainingWork"] || "");
                    if (remain != "") result = result + "<div class='taskRemainingWork'>" + remain + "</div>";



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

function getParentId(workItem) {
    var parentId = -1;
    if (workItem.relations) {
        workItem.relations.forEach(function (item, index) {
            if (item.rel == "System.LinkTypes.Hierarchy-Reverse") {
                parentId = item.url.substring(item.url.lastIndexOf("/") + 1)
            }
        });
    }
    return parentId;
}

function getFirstAvailableDate(days, remainingWork, globalDates) {
    return 0;
}

function getCapacity(name) {
    var result = 6;
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
            var workItemId = ui.helper.attr("workItemId");
            updateWorkItemDates(workItemId, changeDays, changeDays);
            updateWorkItemInVSS();
        }
    }));

    $(".taskTrContent").droppable({
        drop: function (event, ui) {
            var assignedTo = nameById[$(this).closest('tr')[0].cells[0].attributes["assignedtoid"].value].Name;
            var workItemId = ui.draggable.attr("workItemId");
            updateWorkItemAssignTo(workItemId, assignedTo);
        }
    });


    $(".taskStart:not(.taskSaving)").resizable({
        grid: colWidth,
        containment: ".mainTable",
        minWidth: 60,
        handles: 'e',
        cancel: ".taskChanged",
        stop: function (event, ui) {
            var workItemId = ui.element.attr("workItemId");
            var changeDays = (Math.round((ui.size.width - ui.originalSize.width) / colWidth));
            updateWorkItemDates(workItemId, 0, changeDays);
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


function updateWorkItemDates(workItemId, changeStartDays, changeEndDays) {
    var workItem = workItems[workItemId];

    if (workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]) {
        if (changeStartDays != 0 || changeEndDays != 0) {
            workItem.fields["Microsoft.VSTS.Scheduling.StartDate"] =
                new Date(workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]).addDays(changeStartDays).yyyy_mm_dd();

            workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"] =
                new Date(workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"]).addDays(changeEndDays).yyyy_mm_dd();

            pushWitToSave(workItemId);
        }
    }
}

function updateWorkItemAssignTo(workItemId, assignedTo) {
    var workItem = workItems[workItemId];

    if (workItem.fields["System.AssignedTo"] != assignedTo) {
        pushWitToSave(workItemId);
        workItem.fields["System.AssignedTo"] = assignedTo;
    }
}

function getTable(workItems, startDate, endDate, isGMT) {

    var result = new Array();
    var names = {};
    var areaPaths = {};
    var areaPathsId = 1;
    var globalDates = getDates(startDate, endDate);

    for (var i = 0; i < workItems.length; i++) {
        var workItem = workItems[i];
        var assignedTo = workItem.fields["System.AssignedTo"] || "";
        var areaPath = workItem.fields["System.AreaPath"] || "";

        if (isTaskWit(workItem)) {
            if (!areaPaths[areaPath]) {
                areaPaths[areaPath] = { id: areaPathsId };
                areaPathsId = areaPathsId + 1;
            }
            if (!names[assignedTo]) {
                names[assignedTo] = { id: result.length, days: [] };
                var newName = { Name: assignedTo, Capacity: getCapacity(name), TotalCapacity: 0, TatalTasks: 0 };
                for (var colIndex = 0; colIndex < globalDates.length; colIndex++) {
                    var currentDate = globalDates[colIndex];
                    newName[currentDate.yyyymmdd()] = [];
                    if (currentDate >= new Date(new Date().yyyy_mm_dd()) && !isDayOff(assignedTo, currentDate.yyyymmdd(), currentDate.getDay())) {
                        newName.TotalCapacity = newName.TotalCapacity + newName.Capacity;
                    }
                }
                result.push(newName);
                nameById[names[assignedTo].id] = { Name: assignedTo };
            }

            var remainingWork = workItem.fields["Microsoft.VSTS.Scheduling.RemainingWork"] || 0;

            var personRow = result[names[assignedTo].id];
            personRow.assignedTo = assignedTo;
            personRow.assignedToId = names[assignedTo].id;
            personRow.TatalTasks = personRow.TatalTasks + remainingWork;

            var witStartDate = null;
            var capacity = personRow.Capacity;
            var witChanged = false;

            if (!workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]) {
                witChanged = true;
                globalDates.forEach(function (item, index) {
                    var tasksPerDay = names[assignedTo].days[item.yyyymmdd()] || 0;
                    if (tasksPerDay < capacity && !witStartDate && !isDayOff(assignedTo, item.yyyymmdd(), item.getDay())) {
                        witStartDate = item.getGMT();
                    }
                });

                if (!witStartDate) {
                    witStartDate = globalDates[globalDates.length - 1];
                }
                //witStartDate = startDate.addDays(getFirstAvailableDate(names[assignedTo].days, remainingWork, globalDates));
            } else {
                witStartDate = new Date(workItem.fields["Microsoft.VSTS.Scheduling.StartDate"]);
            }

            if (!isGMT) witStartDate = witStartDate.getGMT();

            var witEndDate = null;

            if (!workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"]) {
                witChanged = true;
                var remainingWorkLeft = remainingWork;
                var dates = getDates(witStartDate, endDate);
                dates.forEach(function (item, index) {
                    var tasksPerDay = names[assignedTo].days[item.yyyymmdd()] || 0;

                    if (tasksPerDay < capacity && !isDayOff(assignedTo, item.yyyymmdd(), item.getDay()) && !witEndDate) {

                        var todayPart = remainingWorkLeft;
                        if (tasksPerDay + todayPart > capacity) {
                            todayPart = capacity - tasksPerDay;
                        }
                        remainingWorkLeft = remainingWorkLeft - todayPart;

                        if (remainingWorkLeft == 0) {
                            witEndDate = item.getGMT();
                        }
                    }
                });


                if (!witEndDate) {
                    witEndDate = globalDates[globalDates.length - 1];
                }

            }
            else {
                witEndDate = new Date(workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"] || startDate);
                if (!isGMT) witEndDate = witEndDate.getGMT();

            }

            if (witChanged) {
                pushWitToSave(i);
            }

            if (witStartDate < startDate) witStartDate = startDate;
            if (witStartDate > endDate) witStartDate = endDate;
            if (witEndDate > endDate) witEndDate = endDate;
            if (witEndDate < witStartDate) witEndDate = witStartDate;

            workItem.fields["Microsoft.VSTS.Scheduling.StartDate"] = witStartDate.yyyy_mm_dd();
            workItem.fields["Microsoft.VSTS.Scheduling.FinishDate"] = witEndDate.yyyy_mm_dd();



            if (witStartDate >= startDate && witEndDate <= endDate) {
                var dates = getDates(witStartDate, witEndDate);

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

                for (var colIndex = 0; colIndex < globalDates.length; colIndex++) {
                    var date = globalDates[colIndex].yyyymmdd();
                    personDateCell = personRow[date];
                    while (selectedRow >= personDateCell.length) personDateCell.push({ Type: 0 });
                }

                for (var colIndex = 0; colIndex < dates.length; colIndex++) {
                    var date = dates[colIndex].yyyymmdd();

                    if (!isDayOff(assignedTo, dates[colIndex].yyyymmdd(), dates[colIndex].getDay())) {
                        var todayTasks = (names[assignedTo].days[date] || 0);
                        var todayPart = remainingWork;
                        if (todayTasks + remainingWork > capacity) {
                            todayPart = capacity - todayTasks;
                        }
                        remainingWork = remainingWork - todayPart;
                        names[assignedTo].days[date] = todayTasks + todayPart;
                    }

                    personDateCell = personRow[date];
                    personDateCell[selectedRow] = { Type: 1, part: colIndex, total: dates.length, workItem: workItem, id: i, endDate: dates[dates.length - 1], areaPath: areaPaths[areaPath] };
                }

            }
        }
    }
    return result.sort(function (a, b) { return a.assignedTo.localeCompare(b.assignedTo) });
}