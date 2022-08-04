/*

    KGObjects.js

    prerequisites:
    --------------
    object.js, morphic.js


    toc
    ---
    the following list shows the order in which all constructors are
    defined. Firt of all you can find the functionalities that have
    been added to SpriteMorph and StageMorph.
    Use this list to locate code in this document:

        SpriteMorph
        StageMorph
        SyntaxElementMorph

        Endpoint
        WikiDataEndpoint
        Literal
        Pattern
        Subject
        LogicOperator
        Filter
        Query


    credits
    -------
    Vincenzo Offertucci

*/

/*jshint esversion: 6*/

// Global stuff ////////////////////////////////////////////////////////

modules.KGObjects = '2022-July-10';

// Declarations

var SnapVersion = '7.4.0-dev';

var Endpoint;
var WikiDataEndpoint;
var Literal;
var Pattern;
var Subject;
var LogicOperator;
var Filter;
var Query;

// SpriteMorph ////////////////////////////////////////////////////////

//new category define

SpriteMorph.prototype.categories.push('KGQueries');

SpriteMorph.prototype.blockColor['KGQueries'] = new Color(153, 0, 0);

// new blocks define

const oldInitBlocks = SpriteMorph.prototype.initBlocks;

SpriteMorph.prototype.initBlocks = function (){
    oldInitBlocks();

    SpriteMorph.prototype.blocks["subject"] = {
        type: 'command',
        category: 'KGQueries',
        spec: 'subject: %s %c',
        defaults: [null, null]
    };
    SpriteMorph.prototype.blocks["pattern"] = {
        type: 'command',
        category: 'KGQueries',
        spec: 'predicate: %s object: %s',
        defaults: [null, null]
    };
    SpriteMorph.prototype.blocks["filter"] = {
        type: 'command',
        category: 'KGQueries',
        spec: 'filter: %s',
        defaults: [null]
    };
    SpriteMorph.prototype.blocks["queryBlock"] = {
        type: 'reporter',
        category: 'KGQueries',
        spec: 'select %exp from %s %br where %c %br order by %s %ord %br limit %n',
        defaults: [[], 'https://query.wikidata.org/sparql', null, 10, null, null]
    };
    SpriteMorph.prototype.blocks["literal"] = {
        type: 'reporter',
        category: 'KGQueries',
        spec: '%s @ %s',
        defaults: [null, null]
    };
    SpriteMorph.prototype.blocks["showQueryResults"] = {
        type: 'reporter',
        category: 'KGQueries',
        spec: 'show results %var',
        defaults: [null]
    };
    SpriteMorph.prototype.blocks["getColumn"] = {
        type: 'reporter',
        category: 'KGQueries',
        spec: 'get column %n from %var',
        defaults: [1, null]
    };
    SpriteMorph.prototype.blocks["getRow"] = {
        type: 'reporter',
        category: 'KGQueries',
        spec: 'get row %n from %var',
        defaults: [1, null]
    };
    SpriteMorph.prototype.blocks["searchEntity"] = {
        type: 'reporter',
        category: 'KGQueries',
        spec: 'search an entity: %s',
        defaults: ['something']
    };
    SpriteMorph.prototype.blocks["searchProperty"] = {
        type: 'reporter',
        category: 'KGQueries',
        spec: 'search a property: %s',
        defaults: ['something']
    };
    SpriteMorph.prototype.blocks["translateQueryBlock"] = {
        type: 'reporter',
        category: 'KGQueries',
        spec: 'translate query block: %s',
        defaults: [null]
    };

};

SpriteMorph.prototype.oldBlockTemplates = SpriteMorph.prototype.blockTemplates;

SpriteMorph.prototype.blockTemplates = function (
    category = 'motion',
    all = false
){

    function block(selector, isGhosted) {
        if (StageMorph.prototype.hiddenPrimitives[selector] && !all) {
            return null;
        }
        var newBlock = SpriteMorph.prototype.blockForSelector(selector, true);
        newBlock.isTemplate = true;
        if (isGhosted) {newBlock.ghost(); }
        return newBlock;
    }

    blocks = this.oldBlockTemplates(category, all);
    if (category === 'KGQueries'){
        blocks.push('-');
        blocks.push(block('queryBlock'));
        blocks.push(block('subject'));
        blocks.push(block('pattern'));
        blocks.push(block('showQueryResults'));
        blocks.push(block('literal'));
        blocks.push(block('filter'));
        blocks.push('-');
        blocks.push(block('getColumn'));
        blocks.push(block('getRow'));
        blocks.push('-');
        blocks.push(block('searchEntity'));
        blocks.push(block('searchProperty'));
        blocks.push('-');
        blocks.push(block('translateQueryBlock'));
    }

    return blocks;
};


// selector define for the new blocks

SpriteMorph.prototype.literal = function(string, lang){
    let stringLiteral = '"' + string + '"';
    if(lang !== undefined &&
        lang !== null &&
        lang !== '')
        stringLiteral += "@" + lang;
    return stringLiteral;
};

SpriteMorph.prototype.queryBlock = function (vars, url, block, order, direction, limit) {
    try{
        endpoint = new WikiDataEndpoint('it', this);
        query = new Query(vars, endpoint, block, order, direction, limit);
        preparedUrl = query.prepareRequest();
    }
    catch(e){
        return e.message;
    }
    result = new XMLHttpRequest();
    result.open('GET', preparedUrl, true);
    result.send(null);
    result.onreadystatechange = () => this.showResults(result, block);
    return "Caricamento...";
};

// Creates a global variable named with de value of varName and containing value
// it also adds a watcher to the stage
SpriteMorph.prototype.createResultVar = function (varName, value){
    ide = world.children[0];
    scene = ide.scene;
    stage = this.parentThatIsA(StageMorph);
    scene.globalVariables.addVar(varName, value);
    ide.flushBlocksCache('variables');
    ide.refreshPalette();
    watcher = this.findVariableWatcher(varName);
    if (watcher !== null) {
        watcher.show();
        watcher.fixLayout(); // re-hide hidden parts
        watcher.keepWithin(stage);
        ide.flushBlocksCache('variables');
        ide.refreshPalette();
    }
    else
        this.toggleVariableWatcher(varName, true);
};

//Handles readyState changes and showes query's results
SpriteMorph.prototype.showResults = function (result, block){
    if (result.readyState == 4 && result.status == 200) {
        response = JSON.parse(result.responseText);
        rows = response.results.bindings.length;
        if(rows == 0){
            block.showBubble(
                "Nessun risultato.",
                null,
                null
            );
            return;
        }
        
        entry = Object.entries(response.results.bindings[0]);
        cols = entry.length;
        resultTable = new Table(cols, rows);
        for(i = 0; i<cols; i++)
            resultTable.setColName(i-1, entry[i][0]);
        
        for(i = 0; i<rows; i++){
            for(j = 0; j<cols; j++){
                entry = Object.entries(response.results.bindings[i]);
                resultTable.set(entry[j][1].value, j+1, i+1);
            }
        }
        
        queryResults = {
            rows: rows,
            cols: cols,
            resultTable: resultTable
        };
        this.createResultVar("Results", queryResults);
        this.showQueryResults("Results");
   }
   else if (result.readyState == 4 && result.status == 400) {
        block.showBubble(
            "La query non è corretta.",
            null,
            null
        );
    }
};

function UnvalidBlockException(message){
    this.message = message;
};

//builds the request url starting from the first block
prepareRequest = function(vars, url, block, limit, order, direction) {
    endpoint = new WikiDataEndpoint('it', this);
    query = new Query(vars, endpoint, block, limit, order, direcrion);
    console.log('query');
    console.log(query);
    return query.prepareRequest();
};

//shows query results saved inside varName
SpriteMorph.prototype.showQueryResults = function(varName){
    ide = world.children[0];
    queryResults = ide.getVar(varName);
    console.log(queryResults);
    tableMorph = new TableMorph(queryResults.resultTable);
    tableDialogMorph = new TableDialogMorph(
        tableMorph.table,
        tableMorph.globalColWidth,
        tableMorph.colWidths,
        tableMorph.rowHeight
    ).popUp(this.world());
    console.log(tableMorph);
    return null;
};

// Allow the user to get a single column from a query result
SpriteMorph.prototype.getColumn = function (index, varName){
    ide = world.children[0];
    queryResults = ide.getVar(varName);
    if(typeof(index) !== 'number')
        return queryResults;
    table = queryResults.resultTable;
    resultTable = new Table(1, queryResults.rows);
    resultTable.setColName(-1, table.colName(index));

    tableColumn = table.col(index);
    if(!tableColumn)
        return null;
    for(i = 1; i<=queryResults.rows; i++){
        resultTable.set(tableColumn[i-1], 1, i);
    }
    console.log(table.col(index));
    column = {
        cols: 1,
        rows: queryResults.rows,
        resultTable: resultTable
    };
    return column;
};

// Allow the user to get a single row from a query result
SpriteMorph.prototype.getRow = function (index, varName){
    ide = world.children[0];
    queryResults = ide.getVar(varName);
    if(typeof(index) !== 'number')
        return queryResults;
    table = queryResults.resultTable;
    resultTable = new Table(queryResults.cols, 1);
    resultTable.setColNames(table.columnNames());

    tableRow = table.row(index);
    if(!tableRow)
        return null;
    for(i = 1; i<=queryResults.cols; i++){
        resultTable.set(tableRow[i-1], i, 1);
    }
    console.log(table.row(index));
    row = {
        cols: queryResults.cols,
        rows: 1,
        resultTable: resultTable
    };
    return row;
};

// Allow the user to search for an entity in a knowledge graph
SpriteMorph.prototype.searchEntity = function(search) {
    endpoint = new WikiDataEndpoint('it', this);
    endpoint.searchEntity(search, 'item');
};

// Allow the user to search for a property in a knowledge graph
SpriteMorph.prototype.searchProperty = function(search) {
    endpoint = new WikiDataEndpoint('it', this);
    endpoint.searchEntity(search, 'property');
};

// show search results saved inside varName
SpriteMorph.prototype.showSearchResults = function(varName){
    ide = world.children[0];
    searchResults = ide.getVar(varName);
    dialogBox = new DialogBoxMorph();
    description = searchResults.label + '\n' + searchResults.description + '\n' + searchResults.concepturi;
    dialogBox.inform('Search Results', description, world);
    return null;
};

SpriteMorph.prototype.translateQueryBlock = function(block) {
    console.log('ciaoneeee');
    let endpoint = new WikiDataEndpoint('it', this);
    let query = buildQueryFromQueryBlock(block, endpoint);
    query.prepareRequest();
    dialogBox = new DialogBoxMorph();
    description = query.queryString;
    dialogBox.inform('SPARQL Query', description, world);
    return query.queryString;
};

// StageMorph ///////////////////////////////////////////////////////////

StageMorph.prototype.oldBlockTemplates = StageMorph.prototype.blockTemplates;

StageMorph.prototype.blockTemplates = function (
    category = 'motion',
    all = false
){
    var myself = this;

    function block(selector) {
        if (myself.hiddenPrimitives[selector] && !all) {
            return null;
        }
        var newBlock = SpriteMorph.prototype.blockForSelector(selector, true);
        newBlock.isTemplate = true;
        return newBlock;
    }

    blocks = this.oldBlockTemplates(category, all);
    if (category === 'KGQueries'){
        blocks.push('-');
        blocks.push(block('queryBlock'));
        blocks.push(block('subject'));
        blocks.push(block('pattern'));
        blocks.push(block('showQueryResults'));
        blocks.push(block('literal'));
        blocks.push(block('filter'));
        blocks.push('-');
        blocks.push(block('getColumn'));
        blocks.push(block('getRow'));
        blocks.push('-');
        blocks.push(block('searchEntity'));
        blocks.push(block('searchProperty'));
        blocks.push('-');
        blocks.push(block('translateQueryBlock'));
    }

    return blocks;
}

StageMorph.prototype.literal 
    = SpriteMorph.prototype.literal;

StageMorph.prototype.queryBlock 
    = SpriteMorph.prototype.queryBlock;

StageMorph.prototype.createResultVar 
    = SpriteMorph.prototype.createResultVar;

StageMorph.prototype.showResults 
    = SpriteMorph.prototype.showResults;

StageMorph.prototype.showQueryResults 
    = SpriteMorph.prototype.showQueryResults;

StageMorph.prototype.getColumn 
    = SpriteMorph.prototype.getColumn;

StageMorph.prototype.getRow 
    = SpriteMorph.prototype.getRow;

StageMorph.prototype.searchEntity 
    = SpriteMorph.prototype.searchEntity;

StageMorph.prototype.searchProperty 
    = SpriteMorph.prototype.searchProperty;

StageMorph.prototype.showSearchResults 
    = SpriteMorph.prototype.showSearchResults;
    
StageMorph.prototype.translateQueryBlock 
    = SpriteMorph.prototype.translateQueryBlock;

// SyntaxElementMorph ///////////////////////////////////////////////////////////

SyntaxElementMorph.prototype.labelParts['%ord'] = {
        type: 'input',
        tags: 'read-only static',
        menu: {
            'ASC' : ['ASC'],
            'DESC' : ['DESC']
        }
    };

// Endpoint ///////////////////////////////////////////////////////////

// Represents the generic endpoint for making SPARQL query requests

Endpoint.prototype.constructor = Endpoint;

function Endpoint(baseUrl, language){
    this.init(baseUrl, language);
};

Endpoint.prototype.init = function(baseUrl, language){
    this.baseUrl = baseUrl;
    this.language = language;
};

Endpoint.prototype.searchEntity = function(search){
    return search;
};


// WikiDataEndpoint ///////////////////////////////////////////////////////////

WikiDataEndpoint.prototype = new Endpoint();
WikiDataEndpoint.prototype.constructor = WikiDataEndpoint;
WikiDataEndpoint.uber = Endpoint.prototype;

function WikiDataEndpoint(language, morph){
    this.init(language, morph);
};

WikiDataEndpoint.prototype.init = function(language, morph){
    this.baseUrl = 'https://query.wikidata.org/sparql';
    this.language = language;
    this.morph = morph; // is a SpriteMorph or a StageMorph (if the block is used on a Sprite or a Stage)
    this.entityPrefix = 'wd:';
    this.propertyPrefix = 'wdt:';
};

WikiDataEndpoint.prototype.searchEntity = function(search, type){
    requestUrl = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&language=' 
                + this.language +'&uselang=' + this.language + '&type=' + type 
                + '&format=json&origin=*&search=' + search;
    result = new XMLHttpRequest();
    result.open('GET', requestUrl, true);
    result.send(null);
    result.onreadystatechange = () => {
        json = JSON.parse(result.response);
        if(json.search.length == 0)
            return null;
        first = json.search[0];
        if(type === 'item')
            dataType = 'entity';
        else if(type === 'property')
            dataType = 'property';
        searchResult = {
            id: first.id,
            type: dataType,
            label: first.display.label.value,
            description: first.display.description.value,
            concepturi: first.concepturi
        };
        this.morph.createResultVar('searchResult', searchResult);
        this.morph.showSearchResults('searchResult');
    }
};

// Literal ///////////////////////////////////////////////////////////

Literal.prototype.constructor = Literal;

function Literal(block){
    this.block = block;
}

Literal.prototype.getValue = function (){
    console.log(this.block);
    let stringLiteral = '"';
    stringLiteral += this.getSlotValue(0) + '"';
    let lang = this.block.children[2].children[0].text;
    if(lang !== undefined &&
        lang !== null &&
        lang !== '')
        stringLiteral += "@" + lang;
    return stringLiteral;
}

Literal.prototype.getSlotValue = function(index){
    let slot = this.block.children[index];
    console.log(slot);
    if(slot.selector === 'reportGetVar'){
        let varName = slot.blockSpec;
        let ide = world.children[0];
        let variable = ide.getVar(varName);
        return variable;
    }
    else return slot.children[0].text;
}

// Pattern ///////////////////////////////////////////////////////////

Pattern.prototype.constructor = Pattern;

function Pattern(block, endpoint){
    this.block = block;
    this.endpoint = endpoint;
    this.propertyValue = this.getSlotValue(1);
    this.entityValue = this.getSlotValue(3);
}

//index is the slot's position index which we want to get the value
Pattern.prototype.getSlotValue = function(index){
    let slot = this.block.children[index];
    console.log(slot);
    if(slot.category === 'variables'){
        let varName = slot.blockSpec;
        let ide = world.children[0];
        let variable = ide.getVar(varName);
        if(variable.type === 'entity')
            return this.endpoint.entityPrefix + variable.id;
        if(variable.type === 'property')
            return this.endpoint.propertyPrefix + variable.id;
        return variable;
    }
    else if(slot.selector === 'literal'){
        return new Literal(slot).getValue();
    }
    else return slot.children[0].text;
}

// Subject ///////////////////////////////////////////////////////////

Subject.prototype.constructor = Subject;

function Subject(rootBlock, endpoint){
    this.rootBlock = rootBlock;
    this.endpoint = endpoint;
    this.patternBlocks = [];
    this.varValue = this.getSlotValue();
    inputs = rootBlock.inputs();
    let block = inputs[1].children[0];
    while(block){
        if(block.selector !== 'pattern'){
            this.patternBlocks = [];
                throw new UnvalidBlockException('I blocchi inseriti non sono validi');
        }
        let pattern = new Pattern(block, endpoint);
        this.patternBlocks.push(pattern);
        block = block.nextBlock();
    }
};

Subject.prototype.getTriples = function(){
    if(this.rootBlock !== null && this.rootBlock.selector === 'subject'){
        console.log(this.rootBlock);
        subjectValue = this.varValue;
        triples = subjectValue + ' ';
        for(let i = 0; i<this.patternBlocks.length; i++){
            patternBlock = this.patternBlocks[i];
            predicate = patternBlock.propertyValue;
            object = patternBlock.entityValue;
            triples += predicate + ' ';
            triples += object;
            if(i !== this.patternBlocks.length-1)
                triples += ';';
        }
        triples += '.';
    }
    console.log(triples);
    return triples;
};

Subject.prototype.getSlotValue = function() {
    let slot = this.rootBlock.children[1];
    if(slot.category === 'variables'){
        let varName = slot.blockSpec;
        let ide = world.children[0];
        let variable = ide.getVar(varName);
        if(variable.type === 'entity')
            return this.endpoint.entityPrefix + variable.id;
        if(variable.type === 'property')
            return this.endpoint.propertyPrefix + variable.id;
        return variable;
    }
    else return slot.children[0].text;
}

/*var getParameterAsVariable = (varName, type) => {
    ide = world.children[0];
    try{
        variable = ide.getVar(varName)
        if(variable.type == 'entity')
            variable = 'wd:' + variable.id;
        else if (variable.type === 'property')
            variable = 'wdt:' + variable.id;
    }catch{
        variable = varName;
    }
    return variable;
};*/

// LogicOperator ///////////////////////////////////////////////////////////

LogicOperator.prototype.constructor = LogicOperator;

function LogicOperator(block){
    this.block = block;
    this.selector = block.selector;
    this.text = '';
    this.logicOperators = [];
    this.buildAll();
}

LogicOperator.prototype.buildAll = function(){
    if(this.selector === undefined){
        this.selector = 'plainText';
        this.text = this.block.children[0].text;
    }
    else if(this.selector === 'literal'){
        this.selector = 'plainText';
        let literal = new Literal(this.block);
        this.text = literal.getValue();
    }
    else if(this.selector === 'reportGetVar'){
        this.selector = 'plainText';
        let varName = this.block.blockSpec;
        let ide = world.children[0];
        this.text = ide.getVar(varName);
    }
    else if(this.selector === 'reportAnd' ||
        this.selector === 'reportOr' ||
        this.selector === 'reportEquals' ||
        this.selector === 'reportLessThan' ||
        this.selector === 'reportGreaterThan'){
            this.text = this.block.children[1].text;
            let operator = new LogicOperator(this.block.children[0]);
            this.logicOperators.push(operator);
            operator = new LogicOperator(this.block.children[2]);
            this.logicOperators.push(operator);
    }
    else if(this.selector === 'reportNot'){
        this.text = this.block.children[0].text;
        let operator = new LogicOperator(this.block.children[1]);
        this.logicOperators.push(operator);
    }
    else {
        throw new UnvalidBlockException('I blocchi inseriti non sono validi');
    }
}

LogicOperator.prototype.toString = function(){
    if(this.selector === 'plainText')
        return this.text;
    let string = '';
    if(this.selector === 'reportEquals' ||
    this.selector === 'reportLessThan' ||
    this.selector === 'reportGreaterThan'){
        string += '(' + this.logicOperators[0].toString();
        string += ' ' + this.text + ' ';
        string += this.logicOperators[1].toString() + ')';
    }
    else if(this.selector === 'reportAnd'){
        string += '(' + this.logicOperators[0].toString();
        string += ' && ';
        string += this.logicOperators[1].toString() + ')';
    }
    else if(this.selector === 'reportOr'){
        string += this.logicOperators[0].toString();
        string += ' || ';
        string += this.logicOperators[1].toString();
    }
    else if(this.logicOperators.length === 1){
        string += '!(';
        string += this.logicOperators[0].toString() + ')';
    }
    return string;
}

// Filter ///////////////////////////////////////////////////////////

Filter.prototype.constructor = Filter;

function Filter(block){
    this.block = block;
}

Filter.prototype.getFilter = function(){
    let logicOperator = new LogicOperator(this.block.children[1]);
    console.log(logicOperator.toString());
    return ' FILTER (' + logicOperator.toString() + ')';
}


// Query ///////////////////////////////////////////////////////////

Query.prototype.constructor = Query;

function Query(vars, endpoint, firstBlock, order, direction, limit) {
    this.firstBlock = firstBlock;
    this.subjectBlocks = [];
    this.filterBlocks = [];
    this.endpoint = endpoint;
    this.vars = vars;
    this.queryString = '';
    this.order = order;
    this.direction = direction;
    this.limit = limit;
    let block = firstBlock;
    while(block !== null){
        if(block.selector === 'subject'){
            let subject = new Subject(block, endpoint);
            this.subjectBlocks.push(subject);
        }
        else if(block.selector === 'filter'){
            let filter = new Filter(block);
            this.filterBlocks.push(filter);
        }
        else {
            throw new UnvalidBlockException('I blocchi inseriti non sono validi');
        }
        block = block.nextBlock();
    }
};

Query.prototype.getAllTriples = function () {
    let allTriples = '';
    for(let i = 0; i<this.subjectBlocks.length; i++){
        let subject = this.subjectBlocks[i];
        allTriples += subject.getTriples();
    }
    for(let i = 0; i<this.filterBlocks.length; i++){
        let filter = this.filterBlocks[i];
        allTriples += filter.getFilter();
    }
    return allTriples;
};

Query.prototype.prepareRequest = function () {
    let requestUrl = this.endpoint.baseUrl + '?format=json&query=';
    let queryString = 'SELECT ';
    console.log(this);

    if(this.vars.contents.length > 0 && this.vars.contents[0] !== ''){
        console.log(this.vars);
        for(i = 0; i<this.vars.contents.length; i++){
            queryString += this.vars.contents[i] + ' ';
        }
    }
    else
        throw new UnvalidBlockException('Parametri della select non validi');

    queryString += 'WHERE {';
    queryString += this.getAllTriples();
    queryString += ' SERVICE wikibase:label {bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en"}}';
    
    if(this.isOrdered())
        queryString += ' ORDER BY ' + this.direction + '(' + this.order + ')';

    if(this.limit != undefined && this.limit !== null && Math.round(this.limit) > 0)
        queryString += ' LIMIT ' + Math.round(this.limit);

    this.queryString = queryString;
    requestUrl += queryString;
    console.log(requestUrl);
    return requestUrl;
};

Query.prototype.isOrdered = function() {
    if(this.order === undefined ||
        this.order === null ||
        this.order === '')
        return false;
    if(this.direction === undefined ||
        this.direction === null ||
        this.direction === '')
        this.direction = 'ASC';
    else
        this.direction = this.direction[0];
    return true;
}

function buildQueryFromQueryBlock(queryBlock, endpoint){
    let inputs = queryBlock.inputs();
    selectInputs = inputs[0].inputs();
    let selectInputVars = [];
    ide = world.children[0];

    //getting values from select slots
    for(let i = 0; i<selectInputs.length; i++){
        let varValue;
        if(selectInputs[i].category === 'variables')
            varValue = ide.getVar(selectInputs[i].blockSpec);
        else
            varValue = selectInputs[i].children[0].text;
        selectInputVars.push(varValue);
    }
    //saving array in a list
    let selectVarsList = new List(selectInputVars);

    //getting queryBlock's firstBlock
    let firstBlock = inputs[2].children[0];

    //getting order value
    let order;
    if(inputs[3].category === 'variables')
        order = ide.getVar(inputs[3].blockSpec);
    else
        order = inputs[3].children[0].text;

    //getting direction value
    let direction = inputs[4].constant;

    //getting limit value
    let limit;
    if(inputs[5].category === 'variables')
        limit = ide.getVar(inputs[5].blockSpec);
    else
        limit = inputs[5].children[0].text;

    return new Query(selectVarsList, endpoint, firstBlock, order, direction, limit);
}
