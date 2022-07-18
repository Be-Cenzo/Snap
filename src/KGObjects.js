/*

    KGObjects.js

    prerequisites:
    --------------


    toc
    ---
    the following list shows the order in which all constructors are
    defined. Use this list to locate code in this document:

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
    requestUrl = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&language=' + this.language +'&uselang=' + this.language + '&type=' + type + '&format=json&origin=*&search=' + search;
    console.log(requestUrl);
    result = new XMLHttpRequest();
    result.open('GET', requestUrl, true);
    result.send(null);
    result.onreadystatechange = () => {
        json = JSON.parse(result.response);
        console.log(json);
        if(json.search.length == 0)
            return null;
        temp = json.search[0];
        if(type === 'item')
            dataType = 'entity';
        else if(type === 'property')
            dataType = 'property';
        searchResult = {
            id: temp.id,
            type: dataType,
            label: temp.display.label.value,
            description: temp.display.description.value,
            concepturi: temp.concepturi
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