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
        Pattern
        Subject
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
var pattern;
var Subject;
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
        for(i = 0; i<this.patternBlocks.length; i++){
            patternBlock = this.patternBlocks[i];
            predicate = patternBlock.propertyValue; //getParameterAsVariable(patternBlock.children[1].children[0].text, 'property');
            object = patternBlock.entityValue; //getParameterAsVariable(patternBlock.children[3].children[0].text, 'entity');
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

var getParameterAsVariable = (varName, type) => {
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
};


// Query ///////////////////////////////////////////////////////////

Query.prototype.constructor = Query;

function Query(vars, endpoint, firstBlock) {
    this.firstBlock = firstBlock;
    this.subjectBlocks = [];
    this.endpoint = endpoint;
    this.vars = vars;
    let block = firstBlock;
    while(block !== null){
        if(block.selector === 'subject'){
            subject = new Subject(block, endpoint);
            this.subjectBlocks.push(subject);
        }
        else {
            throw new UnvalidBlockException('I blocchi inseriti non sono validi');
        }
        block = block.nextBlock();
    }
};

Query.prototype.getAllTriples = function () {
    let allTriples = '';
    for(i = 0; i<this.subjectBlocks.length; i++){
        let subject = this.subjectBlocks[i];
        allTriples += subject.getTriples();
    }
    return allTriples;
};

Query.prototype.prepareRequest = function () {
    let requestUrl = this.endpoint.baseUrl + '?query=SELECT ';
    console.log(this);
    if(this.vars.contents.length > 0 && this.vars.contents[0] !== ''){
        console.log(this.vars);
        for(i = 0; i<this.vars.contents.length; i++){
            requestUrl += this.vars.contents[i] + ' ';
        }
    }
    else
        throw new UnvalidBlockException('Parametri della select non validi');
    requestUrl += 'WHERE {';
    requestUrl += this.getAllTriples();
    requestUrl += ' SERVICE wikibase:label {bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en"}}&format=json';
    console.log(requestUrl);
    return requestUrl;
};

Query.prototype.getQuery = function () {
    let query = 'SELECT ';
    console.log(this);
    if(this.vars.contents.length > 0 && this.vars.contents[0] !== ''){
        console.log(this.vars);
        for(i = 0; i<this.vars.contents.length; i++){
            requestUrl += this.vars.contents[i] + ' ';
        }
    }
    else
        throw new UnvalidBlockException('Parametri della select non validi');
    query += 'WHERE {';
    query += this.getAllTriples();
    query += ' SERVICE wikibase:label {bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en"}}&format=json';
    console.log(query);
    return query;
}