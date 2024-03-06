Date.prototype.useNewTimeManagement = false;

Date.prototype.addDays = function(days) {
    var z = this.getTimezoneOffset()
    var x = new Date(this.valueOf() + days * 24 * 60 * 60000);
    var diff = z - x.getTimezoneOffset();
    if (!Date.useNewTimeManagement && diff != 0){
        return new Date(x.valueOf() - (diff * 60000));
    }
    return x;
}

Date.prototype.yyyymmdd = function() {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();

    return [
        this.getFullYear(),
        (mm>9 ? '' : '0') + mm,
        (dd>9 ? '' : '0') + dd
    ].join('');
};

Date.prototype.yyyy_mm_dd = function() {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();

    return [
        this.getFullYear(),
        (mm>9 ? '' : '0') + mm,
        (dd>9 ? '' : '0') + dd
    ].join('/');
};

Date.prototype.mmdd = function() {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();

    return [
        (mm>9 ? '' : '0') + mm,
        (dd>9 ? '' : '0') + dd
    ].join('/');
};



Date.prototype.HHmmss = function() {
    var HH = this.getHours();
    var mm = this.getMinutes();
    var ss = this.getSeconds();
  
    return [
        (HH>9 ? '' : '0') + HH,
        (mm>9 ? '' : '0') + mm,
        (ss>9 ? '' : '0') + ss
    ].join(':');
};


//"2018-01-25T00:00:00Z"
Date.prototype.tfsFormat = function() {
    var mm = this.getMonth() + 1; // getMonth() is zero-based
    var dd = this.getDate();

    return [
        this.getFullYear(),
        (mm>9 ? '' : '0') + mm,
        (dd>9 ? '' : '0') + dd
    ].join('-') + "T00:00:00Z";
  };


Date.prototype.getGMT = function() {

    if (Date.useNewTimeManagement) return this;

    return new Date(
        this.getUTCFullYear(),
        this.getUTCMonth(),
        this.getUTCDate(),
        this.getUTCHours(),
        this.getUTCMinutes(),
        this.getUTCSeconds()
    );
};

Date.prototype.ConvertGMTToServerTimeZone = function() {

    if (!this._serverToGMTDiff){
        this._serverToGMTDiff = (new Date(VSS.Core.convertValueToDisplayString(new Date("2000-01-01"), 'u')).getTime() - new Date("2000-01-01").getTime()) + (new Date().getTimezoneOffset() * 60000);

        if (isNaN(this._serverToGMTDiff)){
            this._serverToGMTDiff = 0;
        }
    }

    if (Date.useNewTimeManagement) this._serverToGMTDiff = 0;
    
    return new Date(this.getTime() - this._serverToGMTDiff);
};



function getDates(startDate, stopDate, includeDateFunction) {
    var dateArray = new Array();
    var currentDate = startDate;
    while (currentDate <= stopDate) {
        if(!includeDateFunction || includeDateFunction(currentDate)){
            dateArray.push( new Date (currentDate) )
        }
        currentDate = currentDate.addDays(1);
    }
    return dateArray;
}

function isDayInRange(range, date){
    var inRange = false;
    $.each(range, function( index2, value2 ) {
        $.each( getDates(value2.start, value2.end), function( index2, value3 ) {
            if (value3.getGMT().yyyymmdd() == date) inRange = true;
        });
    });
    return inRange;
}

function minDate(first, second){
    if(first && second) {
        return new Date(Math.min(first, second));
    } else if (first) {
        return first;
    } else {
        // if second is undefined, then first must also be, so return undefined.
        return second;
    }
}

function maxDate(first, second){
    if(first && second) {
        return new Date(Math.max(first, second));
    } else if (first) {
        return first;
    } else {
        // if second is undefined, then first must also be, so return undefined.
        return second;
    }
}