tablink = window.location.href;
var consistencymessage = "";
var year = 31557600; //365.25
var pregnancy = 23667714;
var longevity_error = 125;
var longevity_warn = 105;
var birthage_young = 12;
var birthage_old = 55;
var marriageage_young = 14;
var spouse_age_dif = 22;
var refreshtoken = false;
var suffixArray = ['i','ii','iii','iv','jr','sr'];
var namecheckoption = true;
var siblingcheckoption = true;
var childcheckoption = true;
var partnercheckoption = true;
var agecheckoption = true;
var socialoption = false;
var wedlock = false;

function buildconsistencyDiv() {
    if (isGeni(tablink)) {
        var consistencydiv = $(document.createElement('div'));
        consistencydiv.attr('id','consistencyck');
        consistencydiv.css({"display": "none", "position": "absolute", "background-color": "#fff", "z-index": "2", "width": "97%", "borderBottom":"solid 1px #cad3dd", "padding": "5px 20px 3px", "vertical-align": "middle", "line-height": "150%"});
        $("#header").after(consistencydiv);
        queryGeni();
    }
}

function queryGeni() {
    focusid = getProfile(tablink).replace("?profile=", "");
    if (focusid === "" && tablink !== "https://www.geni.com/family-tree") {
        return;
    }
    familystatus.push(1);
    var url = smartcopyurl + "/smartsubmit?family=all&focusprofile=true&profile=" + focusid;
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url
    }, function (response) {
        if ((response.source === "[]" || response.source === "") && !refreshtoken) {
            genifamily = [];
            refreshtoken = true;
            var refreshurl = smartcopyurl + "/accountlogin";
            chrome.runtime.sendMessage({
                method: "GET",
                action: "xhttp",
                url: refreshurl
            }, function (response) {
                console.log("Token Refresh...");
                queryGeni();
            });
        } else {
            try {
                genifamily = JSON.parse(response.source);
                chrome.runtime.sendMessage({ "action" : "icon", "path": "images/icon.png" });
            } catch (e) {
                chrome.runtime.sendMessage({ "action" : "icon", "path": "images/icon_warn.png" });
                genifamily = [];
            }
            if (!exists(genifamily)) {
                genifamily = [];
            }
            for (var i = 0; i < genifamily.length; i++) {
                var familymem = genifamily[i];
                genifamilydata[familymem.id] = new GeniPerson(familymem);
            }
        }
        familystatus.pop();
    });
    checkConsistency();
}

$(window).bind('hashchange', function() {
    $("#consistencyck").slideUp();
    $("#fb-sharing-wrapper").show();
    tablink = window.location.href;
    queryGeni();
});

$(window).mouseup(function(event) {
    if ($(event.target).attr('class') === "super blue button") {
        $("#consistencyck").slideUp();
        $("#fb-sharing-wrapper").show();
        queryGeni();
    }
});

function checkConsistency() {
    if (familystatus.length > 0) {
        setTimeout(checkConsistency, 50);
    } else {
        consistencymessage = "";
        var focus = getFocus();
        var parents = getParents();
        var siblings = getSiblings();
        var children = getChildren();
        var partners = getPartners();
        siblings.unshift(focus); //treat the focus as a sibling

        //Compare profiles against themselves
        selfCheck(siblings);
        selfCheck(children);
        selfCheck(partners);
        selfCheck(parents);

        if (parents.length > 2) {
            var parentset = {};
            for (var i=0; i < parents.length; i++) {
                if (!exists(parentset[getGeniData(parents[i], "union")])) {
                    parentset[getGeniData(parents[i], "union")] = [];
                }
                parentset[getGeniData(parents[i], "union")].push(parents[i]);
            }
            for (var union in parentset) {
                if (!parentset.hasOwnProperty(union)) continue;
                partnerCheck(parentset[union]);
            }
        } else {
            partnerCheck(parents);
        }

        siblingCheck(siblings);
        siblingCheck(children);

        //Compare Parent & Siblings (includes focus) relationships
        childCheck(parents, siblings);

        //Compare Focus & Child relationships
        for (var i=0; i < partners.length; i++) {
            parents = [focus, partners[i]];
            partnerCheck(parents);
            children = getChildren(getGeniData(partners[i], "union"));
            childCheck(parents, children);
        }

        updateQMessage();
    }
}

function partnerCheck(partners) {
    if (partnercheckoption) {
        var husband;
        var wife;
        if (isMale(getGeniData(partners[0], "gender"))) {
            husband = partners[0];
            wife = partners[1];
        } else {
            husband = partners[1];
            wife = partners[0];
        }
        var hstatus = getGeniData(husband, "status");
        var wstatus = getGeniData(wife, "status");
        if (hstatus === "") {
            hstatus = reverseRelationship(wstatus);
        } else if (wstatus === "") {
            wstatus = reverseRelationship(hstatus);
        }
        var husband_bdate = unixDate(getGeniData(husband, "birth", "date"));
        var wife_bdate = unixDate(getGeniData(wife, "birth", "date"));
        var husband_ddate = unixDate(getGeniData(husband, "death", "date"));
        var wife_ddate = unixDate(getGeniData(wife, "death", "date"));
        var union_mdate = unixDate(getGeniData(husband, "marriage", "date"));
        if (union_mdate === NaN) {
            union_mdate = unixDate(getGeniData(wife, "marriage", "date"));
        }
        if (husband_bdate + (spouse_age_dif * year) < wife_bdate || husband_bdate - (spouse_age_dif * year) > wife_bdate) {
            //Age different between partners is significant
            consistencymessage = concat("warn") + "More than " + spouse_age_dif + " year age difference between " + buildEditLink(wife) + " and "
                + getPronoun(getGeniData(wife, "gender")) + " " + getStatus(hstatus, getGeniData(husband, "gender")) + " " + buildEditLink(husband) + ".";
        }
        if (validName(getGeniData(wife, "maiden_name")) && getGeniData(wife, "maiden_name") === getGeniData(husband, "last_name")) {
            if (!(getGeniData(husband, "maiden_name") !== "" && getGeniData(husband, "last_name") !== getGeniData(husband, "maiden_name"))) {
                //Maiden name same as husband's last name
                //TODO if you get additional family members, compare this against her father's last name
                consistencymessage = concat("info") + "Birth Surname of " + buildEditLink(wife) + " is the same as the last name of "
                    + getPronoun(getGeniData(wife, "gender")) + " " + getStatus(hstatus, getGeniData(husband, "gender")) + " " + buildEditLink(husband) + ".";
            }
        }
        if (isNaN(husband_ddate) && husband_ddate === wife_ddate) {
            //Husband and wife death dates the same
            consistencymessage = concat("info") + "Death date of " + buildEditLink(husband) + " is the same as the death date of "
                + getPronoun(getGeniData(husband, "gender")) + " " + getStatus(wstatus, getGeniData(wife, "gender")) + " " + buildEditLink(wife) + ".";
        }
        if (isNaN(husband_ddate) && husband_ddate === union_mdate) {
            //Husband death date same as marriage date
            consistencymessage = concat("info") + "Death date of " + buildEditLink(husband) + " is the same as " + getPronoun(getGeniData(husband, "gender"))
                + " marriage date.";
        }
        if (isNaN(wife_ddate) && wife_ddate === union_mdate) {
            //Wife death date same as marriage date
            consistencymessage = concat("info") + "Death date of " + buildEditLink(wife) + " is the same as " + getPronoun(getGeniData(wife, "gender"))
                + " marriage date.";
        }

        for (var i=0;i<partners.length; i++) {
            var partner_bdate = unixDate(getGeniData(partners[i], "birth", "date"));
            var partner_ddate = unixDate(getGeniData(partners[i], "death", "date"));
            var partner_mdate = unixDate(getGeniData(partners[i], "marriage", "date"));
            if (partner_bdate > partner_mdate) {
                //Born after marriage
                consistencymessage = concat("error") + buildEditLink(partners[i]) + " born after " + getPronoun(getGeniData(partners[i], "gender")) + " marriage date.";
            } else if (partner_ddate < partner_mdate) {
                //Died before marriage
                consistencymessage = concat("error") + buildEditLink(partners[i]) + " died before " + getPronoun(getGeniData(partners[i], "gender")) + " marriage date.";
            } else if (partner_bdate + (marriageage_young * year) > partner_mdate) {
                //Implausible marriage age, too young
                consistencymessage = concat("warn") + buildEditLink(partners[i]) + " is under " + marriageage_young + " years old for " + getPronoun(getGeniData(partners[i], "gender")) + " marriage.";
            }
        }
    }
}

function siblingCheck(siblings) {
    if (siblingcheckoption) {
        var day = 86400;
        for (var i = 0; i < siblings.length; i++) {
            for (var j = i+1; j < siblings.length; j++) {
                var sib1_bdate = unixDate(getGeniData(siblings[i], "birth", "date"));
                var sib2_bdate = unixDate(getGeniData(siblings[j], "birth", "date"));
                if ((sib1_bdate < sib2_bdate && sib1_bdate + pregnancy > sib2_bdate) ||
                    (sib1_bdate > sib2_bdate && sib1_bdate - pregnancy < sib2_bdate)) {
                    if ((sib1_bdate < sib2_bdate && sib1_bdate + day > sib2_bdate) ||
                        (sib1_bdate > sib2_bdate && sib1_bdate - day < sib2_bdate)) {
                        //Exclude Twins
                    } else {
                        //Siblings ages too close together
                        consistencymessage = concat("warn") + "Birth date of " + buildEditLink(siblings[i]) + " and " + getPronoun(getGeniData(siblings[i], "gender"))
                            + " " + siblingName(getGeniData(siblings[j], "gender")) + " " + buildEditLink(siblings[j]) + " are within 9 months.";
                    }
                }
            }
        }
    }
}


function childCheck(parents, children) {
    for (var i=0; i < parents.length; i++) {
        var parent_bdate = unixDate(getGeniData(parents[i], "birth", "date"));
        var parent_ddate = unixDate(getGeniData(parents[i], "death", "date"));
        var parent_mdate = unixDate(getGeniData(parents[i], "marriage", "date"));
        if (childcheckoption) {
            for (var x=0; x < children.length; x++) {
                var adj_parent_ddate = parent_ddate;
                if (isMale(getGeniData(parents[i], "gender"))) {
                    adj_parent_ddate = parent_ddate + pregnancy; //Add 9 months to compare conception
                }

                var sibling_bdate = unixDate(getGeniData(children[x], "birth", "date"));
                if (sibling_bdate < parent_bdate) {
                    //Born before parent birth
                    consistencymessage = concat("error") + buildEditLink(children[x]) + " born before the birth of "
                        + getPronoun(getGeniData(children[x], "gender")) + " " + parentName(getGeniData(parents[i], "gender")) + " " + buildEditLink(parents[i]) + ".";
                } else if (sibling_bdate > adj_parent_ddate) {
                    //Born after parent death
                    consistencymessage = concat("error") + buildEditLink(children[x]) + " born after the death of "
                        + getPronoun(getGeniData(children[x], "gender")) + " " + parentName(getGeniData(parents[i], "gender")) + " " + buildEditLink(parents[i]) + ".";
                } else if (sibling_bdate < parent_bdate + (birthage_young * year) + pregnancy) {
                    //Parent too young for child's birth
                    consistencymessage = concat("warn") + buildEditLink(parents[i]) + " is under " + birthage_young + " years old for the birth of " + getPronoun(getGeniData(parents[i], "gender"))
                        + " child " + buildEditLink(children[x]) + ".";
                } else if (isFemale(getGeniData(parents[i], "gender")) && sibling_bdate > parent_bdate + (birthage_old * year)) {
                    //Mother too old for child's birth
                    consistencymessage = concat("warn") + buildEditLink(parents[i]) + " is over " + birthage_old + " years old for the birth of " + getPronoun(getGeniData(parents[i], "gender"))
                        + " child " + buildEditLink(children[x]) + ".";
                } else if (wedlock && i === 0 && sibling_bdate < parent_mdate && !getGeniData(children[x], "adopted")) {
                    //Born before parent marriage
                    consistencymessage = concat("info") + buildEditLink(children[x]) + " born before the marriage of "
                        + getPronoun(getGeniData(children[x], "gender")) + " parents " + buildEditLink(parents[0]) + " and " + buildEditLink(parents[1]) + ".";
                }
            }
        }
    }
}

function selfCheck(familyset) {
    for (var x=0; x < familyset.length; x++) {
        var person = familyset[x];
        var person_bdate = unixDate(getGeniData(person, "birth", "date"));
        var person_bapdate = unixDate(getGeniData(person, "baptism", "date"));
        var person_ddate = unixDate(getGeniData(person, "death", "date"));
        if (agecheckoption) {
            if (person_bdate + longevity_error * year < person_ddate) {
                //Excessive Age Error
                consistencymessage = concat("error") + "The age of " + buildEditLink(person) + " exceeds " + longevity_error + " years.";
            } else if (person_bdate + longevity_warn * year < person_ddate) {
                //Excessive Age Warning
                consistencymessage = concat("warn") + "The age of " + buildEditLink(person) + " exceeds " + longevity_warn + " years.";
            }
            if (person_bdate > person_ddate) {
                var ddate = getGeniData(person, "death", "date");
                var bdate = getGeniData(person, "birth", "date");
                if (!(isYear(ddate) && bdate.contains(ddate))) {
                    //Born after death
                    consistencymessage = concat("error") + "Birth date of " + buildEditLink(person) + " is after " + getPronoun(getGeniData(person, "gender")) + " death date.";
                }
            }
            if (person_ddate === person_bapdate) {
                //Death same as baptism
                consistencymessage = concat("info") + "Death date of " + buildEditLink(person) + " is the same as " + getPronoun(getGeniData(person, "gender"))
                    + " baptism date.";
            }
        }

        if (namecheckoption) {
            if (getGeniData(person, "name").contains("  ")) {
                //Name contains double space
                consistencymessage = concat("info") + buildEditLink(person) + " contains a double space in " + getPronoun(getGeniData(person, "gender")) + " name.";
            }
            if (getGeniData(person, "first_name").contains('&quot;') || getGeniData(person, "first_name").contains('"') || getGeniData(person, "first_name").split("'").length > 2) {
                //Name contains alias
                consistencymessage = concat("info") + buildEditLink(person) + " contains an alias in " + getPronoun(getGeniData(person, "gender")) + " first name.";
            }

            var first_name = getGeniData(person, "first_name").replace(".","");
            if (validName(getGeniData(person, "name")) && getGeniData(person, "name").length > 2 && (getGeniData(person, "name") === getGeniData(person, "name").toUpperCase() || getGeniData(person, "name") === getGeniData(person, "name").toLowerCase())) {
                //Name contains improper use of uppercase/lowercase
                consistencymessage = concat("info") + buildEditLink(person) + " contains incorrect use of uppercase/lowercase in " + getPronoun(getGeniData(person, "gender")) + " name.";
            } else if (validName(getGeniData(person, "maiden_name")) && (getGeniData(person, "maiden_name") === getGeniData(person, "maiden_name").toUpperCase() || getGeniData(person, "maiden_name") === getGeniData(person, "maiden_name").toLowerCase())) {
                //Maiden Name contains improper use of uppercase/lowercase
                consistencymessage = concat("info") + buildEditLink(person) + " contains incorrect use of uppercase/lowercase in " + getPronoun(getGeniData(person, "gender")) + " birth surname.";
            } else if (validName(getGeniData(person, "last_name")) && (getGeniData(person, "last_name") === getGeniData(person, "last_name").toUpperCase() || getGeniData(person, "last_name") === getGeniData(person, "last_name").toLowerCase())) {
                //Last Name contains improper use of uppercase/lowercase
                consistencymessage = concat("info") + buildEditLink(person) + " contains incorrect use of uppercase/lowercase in " + getPronoun(getGeniData(person, "gender")) + " last name.";
            } else if (validName(first_name) && first_name === first_name.toLowerCase()) {
                //First Name contains improper use of lowercase - excluding one letter and uppercase for situations like NN
                consistencymessage = concat("info") + buildEditLink(person) + " contains incorrect use of uppercase/lowercase in " + getPronoun(getGeniData(person, "gender")) + " first name.";
            }

            first_name = first_name.toLowerCase();
            for (var i=0;i < suffixArray.length; i++) {
                if (first_name.endsWith(" " + suffixArray[i])) {
                    //First Name contain suffix
                    consistencymessage = concat("info") + buildEditLink(person) + " appears to contain a suffix in " + getPronoun(getGeniData(person, "gender")) + " first name.";
                }
            }

            if (getGeniData(person, "title") === "Mr" || getGeniData(person, "title") === "Mrs" || getGeniData(person, "title") === "Miss"
                || getGeniData(person, "title") === "Mr." || getGeniData(person, "title") === "Mrs." || getGeniData(person, "title") === "Miss.") {
                //Salutation in title
                consistencymessage = concat("info") + buildEditLink(person) + " contains improper use of salutation in " + getPronoun(getGeniData(person, "gender")) + " title.";
            }
        }
    }
}

function validName(name) {
    return (name.length > 1 && isASCII(name) && name !== "NN" && name !== "unknown");
}

function isASCII(str) {
    return /^[\x00-\x7F]*$/.test(str);
}

function unixDate(obj) {
    //For consistency checks, include only exact and circa
    if (obj === "" || obj.contains("Before") || obj.contains("After") || obj.contains("Between") || !hasYear(obj)) {
        return NaN;
    } else if (obj.contains("Circa")) {
        obj = obj.replace("Circa", "");
    }
    obj = reformatYear(obj);
    if (obj.contains("-")) {
        //Moment doesn't recognize negative years
        var edate = moment(obj.replace("-", ""), ["YYYY", "MMM YYYY", "MMM D YYYY"]).unix();
        var dsplit = obj.split("-");
        return edate - (parseInt(dsplit[dsplit.length -1]) * year * 2);
    } else {
        return moment(obj, ["YYYY", "MMM YYYY", "MMM D YYYY"]).unix();
    }
}

function isYear(date) {
    return date.search(/^-?\d{3,4}$/) !== -1;
}

function hasYear(date) {
    if (!isNaN(date)) {
        return true;
    }
    var dsplit = date.split(" ");
    if (dsplit.length > 2) {
        //3 elements
        return true;
    } else if (date.contains(" -")) {
        //BC year
        return true;
    } else if (dsplit.length > 1 && !isNaN(dsplit[1]) && parseInt(dsplit[1]) > 31) {
       return true;
    }
    return false;
}

function reformatYear(date) {
    var neg = "";
    if (date.contains("-")) {
        neg = "-";
        date = date.replace("-", "");
    }

    var dsplit = date.split(" ");
    if (!isNaN(dsplit[dsplit.length-1])) {
        dsplit[dsplit.length-1] = neg + ("0000" + dsplit[dsplit.length-1]).substr(-4,4);
    }
    return dsplit.join(" ").trim();
}

function buildEditLink(person) {
    if (startsWithHTTP(tablink, "https://www.geni.com/family-tree")) {
        return "<a href='javascript:openEditCard(\"" + getGeniData(person, "guid") + "\"); void 0'>" + getGeniData(person, "name") + "</a>";
    }
    return "<a href='https://www.geni.com/profile/edit_basics/" + getGeniData(person, "guid") + "'>" + getGeniData(person, "name") + "</a>";
}

function updateQMessage() {
    if (consistencymessage !== "") {
        $("#consistencyck").html("<span class='consistencyslide' style='cursor: pointer; float: right; margin-top: -1px; padding-left: 10px;'><img src='"+ chrome.extension.getURL("images/content_close.png") + "' style='width: 16px;'></span><a href='https://www.geni.com/projects/SmartCopy/18783' target='_blank'><img src='" + chrome.extension.getURL("images/icon.png") + "' style='width: 16px; margin-top: -3px; padding-right: 5px;' title='SmartCopy'></a></img><strong>Consistency Check:</strong>"
            + consistencymessage);
        $('.consistencyslide').off();
        $('.consistencyslide').on('click', function () {
            $("#consistencyck").slideUp();
            $("#fb-sharing-wrapper").show();
        });
        $("#fb-sharing-wrapper").hide();
        $("#consistencyck").slideDown();
    } else {
        $("#consistencyck").slideUp();
        $("#fb-sharing-wrapper").show();
    }
}

function getPronoun(gender) {
    if (isFemale(gender)) {
        return "her";
    } else if (isMale(gender)) {
        return "his";
    } else {
        return "their";
    }
}

function parentName(gender) {
    if (isFemale(gender)) {
        return "mother";
    } else if (isMale(gender)) {
        return "father";
    } else {
        return "parent";
    }
}

function siblingName(gender) {
    if (isFemale(gender)) {
        return "sister";
    } else if (isMale(gender)) {
        return "brother";
    } else {
        return "sibling";
    }
}

function getStatus(relation, gender) {
    if (relation === "partner") {
        return relation;
    } else if (relation === "mother") {
        return "wife";
    } else if (relation === "father") {
        return "husband";
    } else {
        if (isFemale(gender)) {
            return "wife";
        } else if (isMale(gender)) {
            return "husband";
        } else {
            return relation;
        }
    }
}

function concat(type) {
    var icon = "<img src='" + chrome.extension.getURL("images/content_" + type + ".png") + "' style='width: 14px; padding-left: 6px; padding-right: 2px; margin-top: -3px;'>";
    if (consistencymessage !== "") {
        return consistencymessage += icon;
    }
    return icon;
}

chrome.storage.local.get('geniconsistency', function (result) {
    if (result.geniconsistency) {
        buildconsistencyDiv();
    } else if (result.geniconsistency === undefined) {
        chrome.storage.local.set({'geniconsistency': true});
        buildconsistencyDiv();
    }
});

chrome.storage.local.get('namecheck', function (result) {
    if (result.namecheck !== undefined) {
        namecheckoption = result.namecheck;
    }
});

chrome.storage.local.get('siblingcheck', function (result) {
    if (result.siblingcheck !== undefined) {
        siblingcheckoption = result.siblingcheck;
    }
});

chrome.storage.local.get('agelimitwarn', function (result) {
    if (result.agelimitwarn !== undefined) {
        longevity_warn = result.agelimitwarn;
    }
});

chrome.storage.local.get('agelimiterror', function (result) {
    if (result.agelimiterror !== undefined) {
        longevity_error = result.agelimiterror;
    }
});

chrome.storage.local.get('childcheck', function (result) {
    if (result.childcheck !== undefined) {
        childcheckoption = result.childcheck;
    }
});

chrome.storage.local.get('partnercheck', function (result) {
    if (result.partnercheck !== undefined) {
        partnercheckoption = result.partnercheck;
    }
});

chrome.storage.local.get('agecheck', function (result) {
    if (result.agecheck !== undefined) {
        agecheckoption = result.agecheck;
    }
});

chrome.storage.local.get('birthyoung', function (result) {
    if (result.birthyoung !== undefined) {
        birthage_young = result.birthyoung;
    }
});

chrome.storage.local.get('birthold', function (result) {
    if (result.birthold !== undefined) {
        birthage_old = result.birthold;
    }
});

chrome.storage.local.get('marriageyoung', function (result) {
    if (result.marriageyoung !== undefined) {
        marriageage_young = result.marriageyoung;
    }
});

chrome.storage.local.get('marriagedif', function (result) {
    if (result.marriagedif !== undefined) {
        spouse_age_dif = result.marriagedif;
    }
});

chrome.storage.local.get('socialcheck', function (result) {
    if (result.socialcheck !== undefined) {
        socialoption = result.socialcheck;
        if (socialoption) {
            $('#fb-sharing-wrapper').css('visibility', 'hidden');
        }
    }
});

chrome.storage.local.get('wedlockcheck', function (result) {
    if (result.wedlockcheck !== undefined) {
        wedlock = result.wedlockcheck;
    }
});