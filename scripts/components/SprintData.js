function SprintData(workitems, repository, existingSprint) {
    this.RawWits = workitems;
    this.Wits = [];
    this.AllWits = [];

    this.Repository = repository;
    this.StartDate = new Date(repository.IterationStartDate.toISOString()).getGMT();
    this.EndDate = new Date(repository.IterationFinishDate.toISOString()).getGMT();
    this.FirstWorkingDay = new Date(repository.IterationFirstWorkingDate.toISOString()).getGMT();
    this.LastWorkingDay = new Date(repository.IterationLastWorkingDate.toISOString()).getGMT();

    this.Dates;
    this.FilterTerm = '';
    this.FilterArea = '';

    this.ViewByTasks = true;
    this.PlanningIssues = this.Repository.GetSettings().highlightPlanningIssues;
    this.nameById = [];

    if (existingSprint){
        this.ViewByTasks = existingSprint.ViewByTasks;
        this.FilterTerm = existingSprint.FilterTerm;
        this.FilterArea = existingSprint.FilterArea;
        this.PlanningIssues = existingSprint.PlanningIssues;
    }


    this.IsSameWorkItems = function (newWorkItems){
        if (!newWorkItems){
            return false;
        }
        if (newWorkItems.length != this.RawWits.length){
            return false;
        }
        var res = true;
        this.RawWits.forEach(function (item, index) {
            var item2 = newWorkItems[index];
            if (!item2 ||
                item.id != item2.id ||
                item.rev != item2.rev)
                {
                    res = false;
                }
        });

        return res;
    }

    this.Init = function () {
        var items = [];
        var _this = this;
        this.RawWits.forEach(function (item, index) {
            items.push(new Workitem(item, repository.WorkItemTypes, repository.WorkItemPBITypes));
        });
        this.AllWits = items;

        this.AllWits.forEach(function (item, index) {
            var parentId = item.GetParentId();
            if (parentId != -1) {
                var parent = _this.GetWorkitemByIdFromAll(parentId);
                if (parent) {
                    item.ParentTitle = parent.Title;
                    item.ParentTags = parent.Tags;
                    const activity = item.Activity || "";

                    let childActivity=parent.childActivities[activity]
                    if (childActivity){
                        childActivity.MinStart=minDate(childActivity.MinStart, item.StartDate);
                        childActivity.MaxFinish=maxDate(childActivity.MaxFinish, item.FinishDate);
                    } else {
                        parent.childActivities[activity]={MinStart: item.StartDate, MaxFinish: item.FinishDate};
                    }
                }
            }
        });

        this.Wits = SortWits(this.FilerWits(items));

        this.Dates = getDates(this.StartDate, this.EndDate, repository.IncludeDayOnPlan);
    }

    this.FilerWits = function (items) {
        filterTerm = this.FilterTerm;
        filterArea = this.FilterArea;

        return items.filter(function (a) {
            a.AllSearchable = a.AreaPath + ' ' + a.AssignedToComboName + ' ' + a.Title + ' ' + a.ParentTitle + ' ' + a.State + ' ' + a.Activity + ' ' + a.Tags + ' ' + a.ParentTags;

            return filterTerm == '' ||
                   filterTerm == undefined ||
                   (a[filterArea] != undefined && a[filterArea].toLowerCase().includes(filterTerm.toLowerCase()));
        })
    }

    function SortWits(items) {

        return items.sort(function (a, b) {

            if (a.isTaskWit && b.isTaskWit) {
    
                if (!a.StartDate && !b.StartDate) {
                    var parentIda = a.GetParentId();
                    var parentIdb = b.GetParentId();
                    var pa = null, pb = null;
    
                    if (parentIda == parentIdb) {
                        pa = a.BacklogPriority || 0;
                        pb = b.BacklogPriority || 0;
                    } else {
                        items.forEach(function (item, index) {
                            if (item.Id == parentIda) pa = item.BacklogPriority || 0;
                            if (item.Id == parentIdb) pb = item.BacklogPriority || 0;
                        });
    
                        if (pa == pb){
                            pa = a.BacklogPriority || 0;
                            pb = b.BacklogPriority || 0;
                        }
                    }
    
                    if ((pa || 0) != 0 && (pb || 0) != 0) {
                        return pa - pb;
                    }
                } else if (!a.StartDate && b.StartDate) {
                    return 1;
                } else if (a.StartDate && !b.StartDate) {
                    return -1;
                }
    
    
            }
    
            return a.Id - b.Id;
        });
    }

    this.GetWorkitemById = function (id) {
        return jQuery.grep(this.Wits, function (element) { return element.Id == id; })[0];
    }

    this.GetWorkitemByIdFromAll = function (id) {
        return jQuery.grep(this.AllWits, function (element) { return element.Id == id; })[0];
    }

    this.GetWorkitemsByIdsFromAll = function (ids) {
        return ids.map(
            (id)=> this.GetWorkitemByIdFromAll(id)
        ).filter((workItem) => workItem);
    }

    this.GetAssignToNameById = function(id){
        return this.nameById[id];
    }

    this.Init();

    this.GetData = function () {

        var result = new Array();
        var names = {};
        var areaPaths = {};
        var areaPathsId = 1;

        repository.GetMembersWithCapacity().forEach(
            (member)=>{
            AddPersonToResults.call(this, names, member.name, member.displayName, member, result);
            }
        );

        for (var i = 0; i < this.Wits.length; i++) {
            var workItem = this.Wits[i];
            var personRow;
            
            AddPersonToResults.call(this, names, workItem.AssignedToDisplayName, workItem.AssignedToComboName, workItem.OriginalAssignedTo, result);

            personRow = result[names[workItem.AssignedToComboName].id];

            var remainingWork = 0;

            if (workItem.isTaskWit) {

                remainingWork = workItem.RemainingWork;
                personRow.TatalTasks = personRow.TatalTasks + remainingWork;
            }

            if ((!this.ViewByTasks && workItem.isPBIWit) || (this.ViewByTasks && workItem.isTaskWit)) {
                if (!areaPaths[workItem.AreaPath]) {
                    areaPaths[workItem.AreaPath] = { id: areaPathsId };
                    areaPathsId = areaPathsId + 1;
                }

                personRow.hasItems = true;

                var isWitTask;


                if (this.ViewByTasks && workItem.isTaskWit) {

                    isWitTask = true;
                    var capacity = personRow.Capacity;
                    var witChanged = false;

                    if (!workItem.StartDate) {
                        witChanged = true;
                        this.Dates.forEach(function (item, index) {
                            var tasksPerDay = names[workItem.AssignedToComboName].days[item.yyyymmdd()] || 0;
                            if ((tasksPerDay < capacity || capacity == 0) && !workItem.StartDate && !repository.IsDayOff(workItem.OriginalAssignedTo, item.yyyymmdd(), item.getDay()) && (item >= _today)) {
                                workItem.StartDate = item;
                            }
                        });

                        if (!workItem.StartDate) {
                            workItem.StartDate = sprint.LastWorkingDay;
                        }
                    }

                    if (!workItem.FinishDate) {
                        witChanged = true;
                        var remainingWorkLeft = remainingWork;
                        var dates = getDates(workItem.StartDate, sprint.EndDate, repository.IncludeDayOnPlan);
                        dates.forEach(function (item, index) {
                            var tasksPerDay = names[workItem.AssignedToComboName].days[item.yyyymmdd()] || 0;

                            if ((tasksPerDay < capacity || capacity == 0) && !repository.IsDayOff(workItem.OriginalAssignedTo, item.yyyymmdd(), item.getDay()) && !workItem.FinishDate) {

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
                            workItem.FinishDate = sprint.LastWorkingDay;
                        }

                    }

                    if (witChanged) {
                        pushWitToSave(workItem.Id);
                    }

                }

                if (!this.ViewByTasks && workItem.isPBIWit) {
                    isWitTask = false;
                    workItem.StartDate = sprint.EndDate;
                    workItem.FinishDate = sprint.StartDate;

                    if (workItem.Relations) {
                        workItem.Relations.forEach(function (item, index) {
                            if (item.rel == "System.LinkTypes.Hierarchy-Forward") {
                                var childId = item.url.substring(item.url.lastIndexOf("/") + 1);
                                var childWit = sprint.GetWorkitemByIdFromAll(childId);
                                if (childWit) {

                                    if (childWit.Blocked == "Yes") {
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

                if (workItem.StartDate < sprint.FirstWorkingDay) workItem.StartDate = sprint.FirstWorkingDay;
                if (workItem.StartDate > sprint.LastWorkingDay) workItem.StartDate = sprint.LastWorkingDay;
                if (workItem.FinishDate > sprint.LastWorkingDay) workItem.FinishDate = sprint.LastWorkingDay;
                if (workItem.FinishDate < workItem.StartDate) workItem.FinishDate = workItem.StartDate;

                dates = getDates(workItem.StartDate, workItem.FinishDate, repository.IncludeDayOnPlan);

                if (!personRow.hasEndsOnNonWorkingDay){
                    personRow.hasEndsOnNonWorkingDay = repository.IsTeamDayOff(workItem.FinishDate) || repository.IsTeamDayOff(workItem.StartDate);
                }

                let selectedRow = -1;
                let found = false;
                while (!found) {
                    found = true;
                    selectedRow = selectedRow + 1;
                    for (const element of dates) {
                        const date = element.yyyymmdd();
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

                    if (!this.Repository.IsDayOff(workItem.OriginalAssignedTo, dates[colIndex].yyyymmdd(), dates[colIndex].getDay())) {
                        var todayTasks = (names[workItem.AssignedToComboName].days[date] || 0);
                        var todayPart = remainingWork;
                        if (todayTasks + remainingWork > capacity) {
                            todayPart = capacity - todayTasks;
                        }
                        remainingWork = remainingWork - todayPart;
                        names[workItem.AssignedToComboName].days[date] = todayTasks + todayPart;
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

    function AddPersonToResults(names, AssignedToDisplayName, AssignedToComboName, OriginalAssignedTo, result) {
        if (!names[AssignedToComboName]) {
            names[AssignedToComboName] = { id: result.length, days: [] };
            var newName = {
                Name: AssignedToDisplayName,
                Capacity: this.Repository.GetCapacity(OriginalAssignedTo),
                TotalCapacity: 0,
                TatalTasks: 0,
                assignedTo: AssignedToComboName,
                avatar: this.Repository.GetMemberImage(OriginalAssignedTo),
                assignedToId: result.length,
                hasItems: false,
                hasEndsOnNonWorkingDay: false,
            };
            for (var colIndex = 0; colIndex < this.Dates.length; colIndex++) {
                var currentDate = this.Dates[colIndex];
                var isDayOff = this.Repository.IsDayOff(OriginalAssignedTo, currentDate.yyyymmdd(), currentDate.getDay());
                var isTeamDayOff = this.Repository.IsTeamDayOff(currentDate);
                newName[currentDate.yyyymmdd()] = [];
                newName[currentDate.yyyymmdd()].isDayOff = isDayOff;
                newName[currentDate.yyyymmdd()].isTeamDayOff = isTeamDayOff;

                if (currentDate >= _today && !isDayOff) {
                    newName.TotalCapacity = newName.TotalCapacity + newName.Capacity;
                }
            }

            result.push(newName);
            this.nameById[names[AssignedToComboName].id] = { OriginalAssignedTo: {...OriginalAssignedTo, displayName:OriginalAssignedTo?.displayName?.split("<")[0].trim() || ""} };
        }
    }
}
