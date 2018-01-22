function SprintData(workitems, startDate, endDate){

    this.RawWits = workitems;
    this.Wits = [];
    
    this.StartDate = startDate.getGMT();
    this.EndDate = endDate.getGMT();

    this.Dates;

    this.Init = InitFunc;

    this.Init();

    function InitFunc(){
        var items = [];
        this.RawWits.forEach( function(item, index) {
            items.push( new Workitem(item) );
        });

        this.Wits = SortWits(items);

        this.Dates = getDates(this.StartDate, this.EndDate);
        
    }

    function SortWits(items){
        
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

    this.GetWorkitemById = function( id ){
        return jQuery.grep(this.Wits, function (element) { return element.Id == id; })[0];
    } 

}