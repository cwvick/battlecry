
/**
 *  loads (synchronous) a JSON object from an url
 * @param url URL where the JSON object is located
 * @return {*} the JSON object
 */
function loadJSON(url) {
    var data;
    $.ajax({
        async: false,
        url: url,
        dataType: 'json',
        success: function(response){
            data = response;
        }
    });
    return data;
}

// load config.json
var config = loadJSON('../../config.json');
