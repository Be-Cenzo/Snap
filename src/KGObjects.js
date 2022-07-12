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
    this.morph = morph; // is a SpriteMorph or a StageMorph (if the block is used on a Sprite or a Stage) ma in realtà poi è la window
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


// Subject ///////////////////////////////////////////////////////////

Subject.prototype.constructor = Subject;

function Subject(rootBlock){
    this.rootBlock = rootBlock;
    this.patternBlocks = [];
    inputs = rootBlock.inputs(); //da controllare
    let block = inputs[1].children[0];
    while(block){
        if(block.selector !== 'pattern'){
            this.patternBlocks = [];
                throw new UnvalidBlockException('I blocchi inseriti non sono validi');
        }
        this.patternBlocks.push(block);
        block = block.nextBlock();
    }
};

Subject.prototype.getTriples = function(){
    if(this.rootBlock !== null && this.rootBlock.selector === 'subject'){
        subjectValue = getParameterAsVariable(this.rootBlock.children[1].children[0].text, 'entity');
        triples = subjectValue + ' ';
        for(i = 0; i<this.patternBlocks.length; i++){
            patternBlock = this.patternBlocks[i];
            predicate = getParameterAsVariable(patternBlock.children[1].children[0].text, 'property');
            object = getParameterAsVariable(patternBlock.children[3].children[0].text, 'entity');
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
            subject = new Subject(block);
            this.subjectBlocks.push(subject);
        }
        else {
            throw new UnvalidBlockException('I blocchi inseriti non sono validi');
        }
        block = block.nextBlock();
    }
};

Query.prototype.getAllTriples = function () {
    allTriples = '';
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