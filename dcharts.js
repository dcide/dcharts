/**
Dcharts é uma biblioteca Javascript para a criação de gráficos 
dinâmicos. Desenvolvido pela Dcide LTDA e disponibilizado pela 
mesma para a comunidade.

Este software é software livre e pode ser distribuído e 
utilizado desde que se mantenham os créditos originais e 
se obedeçam os termos da licensa.

===========================================================
LICENSE
===========================================================
Copyright (c) 2012 Dcide LTDA.

Permission is hereby granted, free of charge, to any person 
obtaining a copy of this software and associated documentation 
files (the "Software"), to deal in the Software without 
restriction, including without limitation the rights to use, 
copy, modify, merge, publish, distribute, sublicense, and/or 
sell copies of the Software, and to permit persons to whom 
the Software is furnished to do so, subject to the following 
conditions:

The above copyright notice and this permission notice shall 
be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES 
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE 
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION 
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN 
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
IN THE SOFTWARE.

**/



var debug = function(out)
{
	try{
		//console.log(JSON.stringify(out));
	}
	catch(err){}
}


var JSONcopy = function(theObject)
{
	return eval('(' + JSON.stringify(theObject)+')');
}

var ObjRegistry = Class.create({
	firstEmptyIndex: 1,
	allObjects: {},
	
	register: function(obj)
	{
		objId = this.firstEmptyIndex;
		this.allObjects[objId] = obj;
		this.firstEmptyIndex++;
		
		return (objId);
	},
	
	remove: function(id)
	{
		delete(this[id]);
	},
	
	get: function(id)
	{
		return this.allObjects[id];
	}
});

var objRegistry = new ObjRegistry();

var DChartNode = Class.create({

	initialize: function(parentNode, relationToParent, data, name)
	{	
		this.objId = objRegistry.register(this);
		this.relations = {};
		
		this.name = name;
		this.setClassNameAndName();
		if (parentNode != undefined)
		{
			this.parentNode = parentNode;
			this.context = parentNode.myContext;
			this.myContext = this.context + '.' + this.className + ':' + this.name;
			this.parentNode.addRelationToNode(this, relationToParent);
		}
		
		this.setData(data);
	},
	
	setData: function(data)
	{
		this.originalData = JSONcopy(data);
		this.data = JSONcopy(this.originalData);
		
		this.applyDefaultData();
		
		this.processData();
		
		if (this.drawn)
			this.updateDrawing();
			
		this.fire('datachange', {changedObj: this});
	},
	
	processData: function()
	{
	},
	
	getData: function()
	{
		return JSONcopy(this.originalData);
	},
	
	getComputedData: function()
	{
		return JSONcopy(this.data);
	},
	
	addRelationToNode: function(obj, relation)
	{
		if (this.relations[relation] == undefined)
			this.relations[relation] = {};
		if (this.relations[relation][obj.className] == undefined)
			this.relations[relation][obj.className] = {};
			
		this.relations[relation][obj.className][obj.name] = obj;
		
		if (relation.indexOf('^') == -1)
		{  //POG check wheter for it not to break
			if (obj !== false)
				obj.addRelationToNode(this, '^' + relation);
		}
	},
	
	/*Didn't Test*/
	removeRelationToNode: function(obj, relation)
	{
		delete(this.relatedObjects[relation][obj.className][obj.name]);
	},
	
	/*Test func*/
	gouranga: function()
	{
		return ('oh gouranga, it did work');
	},
	
	invokeRelatedNodes: function(path, funcName)
	{
		var returns = [];
		var nodes = this.getNode(path);
		var returnOnlyFirst = false;
		
		if (!(typeof(nodes) == 'object' && (nodes instanceof Array)))
		{
			returnOnlyFirst = true;
			if (nodes != false);
				nodes = [nodes];
		}
		
		var i;
		
		for (i = 0; i < nodes.length; i++)
		{
			if (nodes[i][funcName] != undefined)
				returns[i] = nodes[i][funcName].apply(nodes[i], Array.prototype.slice.call(arguments, 2));
			else
				throw {
					func: "DChartNode.invokeRelatedNodes", 
					error: "1", 
					message: "invoked function doesn't exist in current node",
					moreInfo: {
						node: nodes[i],
						funcName: funcName
					}
				};
		}
		
		if (returnOnlyFirst)
			return returns[0];
		else
			return returns;
	},
	
	/*Didn't Test*/
	
	removeMeFromOppositeRelations: function()
	{
		for (relation in this.relations)
		{
			if (relation.indexOf('opposite') != -1)
			{
				for (className in this.relations[relation])
				{
					for(objName in this.relations[relation][className])
					{
						this.relations[relation][className][objName].removeRelationsToNode(
							this.relations[relation][className][objName],
							relation.replace('^','')
						);
						delete(this.relations[relation][className][objName]);
					}
				}
			}
		}
	},
	
	/* The paths are like this:

	DChart:13-contains.DSeriesGroup-uses.DCanvas
	DChart:13-contains.DSeriesGroup-contains.DSerie:name.DPoint:4
	DChart:13-contains.DSeriesGroup-contains.DSerie:name.DPoint:{x=3}
	
	DChart:13.contains-DSeriesGroup.uses-DCanvas
	DChart:13.contains-DSeriesGroup.contains-DSerie:name.DPoint:4
	DChart:13.contains-DSeriesGroup.contains-DSerie:name.DPoint:{x=3}

	is the same as (the relation can be ignored):

	DChart:13.DSeriesGroup.DCanvas
	DChart:13.DSeriesGroup.DSerie:name.DPoint:4
	
	.DSeriesGroup.DSerie:name.DPoint:*	--- gets the current context, and all the childs
	.DSeriesGroup.DSerie:name.*
	.DSeriesGroup.DSerie:name.contains-*

	Yet to implement {x=3}
	Yet to implement .*:carlos 
	
	*/
	
	getNode: function(path)
	{
		var nodes = [];
		var drawn = false;
		
		firstChar = path.substr(0,1);
	
		if (firstChar == '.' || firstChar == '-' || firstChar == '')
		{
			path = this.myContext + path;
		}
		
		nodeDesc = path.split('.');
		
		var i;
		for (i = 0; i < nodeDesc.length; i++) //parses the string
		{
			nodes[i] = {};
			relationRest = nodeDesc[i].split('-');
			
			if (relationRest[1] != undefined)
			{
				nodes[i].relation = relationRest[0];
				rest = relationRest[1];
			}
			else
			{
				rest = relationRest[0];
			}
			
			theClassSearchExp = rest.split(':');
			
			nodes[i].theClass = theClassSearchExp[0];
			
			if (theClassSearchExp[1] != undefined)
			{	
				nodes[i].searchExp = theClassSearchExp[1];
			}
		}
		
		if (nodes[0].theClass != 'DChart' || nodes[0].searchExp == undefined) return false;
		
		i = 0;
		curObj = objRegistry.get(nodes[0].searchExp);
		i++;
		
		multipleNodes = false;
		multipleClasses = false;
		multipleNames = false;
		
		for (; i < nodes.length; i++)
		{
			if (nodes[i].theClass == '*' && (i == nodes.length - 1))
			{
				multipleNodes = true;
				multipleClasses = true;
				foundNodes = [];
			}
			
			if (nodes[i].searchExp != undefined && nodes[i].searchExp == '*' && (i == nodes.length - 1))
			{
				multipleNodes = true;
				multipleNames = true;
				foundNodes = [];
			}
		
			foundOne = false;
			if (nodes[i].relation != undefined)
			{
				if (curObj.relations[nodes[i].relation] == undefined)
				{
					if (multipleNodes) return [];
					else return false;
				}
				if (!multipleNodes && curObj.relations[nodes[i].relation][nodes[i].theClass] == undefined)
					return false;
				
				if (nodes[i].searchExp != undefined)
				{	
					if (multipleNames)
					{
						for (name in curObj.relations[nodes[i].relation][nodes[i].theClass])
						{
							if (curObj.relations[nodes[i].relation][nodes[i].theClass].hasOwnProperty(name) && 
								typeof(curObj.relations[nodes[i].relation][nodes[i].theClass][name] !== 'function'))
							{
								foundNodes.push(curObj.relations[nodes[i].relation][nodes[i].theClass][name]);
							}
						}
						return foundNodes;
					}
					else
					{
						if (curObj.relations[nodes[i].relation][nodes[i].theClass][nodes[i].searchExp] == undefined)
							return false;
						curObj = curObj.relations[nodes[i].relation][nodes[i].theClass][nodes[i].searchExp];
					}
				}
				else
				{
					if (multipleClasses)
					{
						for (className in curObj.relations[nodes[i].relation])
						{
							for (name in curObj.relations[nodes[i].relation][className])
							{
								if (curObj.relations[nodes[i].relation][className].hasOwnProperty(name) && 
									typeof(curObj.relations[nodes[i].relation][className][name] !== 'function'))
								{
									foundNodes.push(curObj.relations[nodes[i].relation][className][name]);
								}
							}
						}
						return foundNodes;
					}
					else
					{
						foundOne = false;
						for (name in curObj.relations[nodes[i].relation][nodes[i].theClass])
						{
							if (curObj.relations[nodes[i].relation][nodes[i].theClass].hasOwnProperty(name) && 
								typeof(curObj.relations[nodes[i].relation][nodes[i].theClass][name] !== 'function'))
							{
								curObj = curObj.relations[nodes[i].relation][nodes[i].theClass][name];
								foundOne = true;
								break;
							}
						}
						if (!foundOne)
							return false;
					}
				}
			}
			else
			{
				outerLoop: for (relation in curObj.relations)
				{
					if (!multipleClasses && (curObj.relations[relation][nodes[i].theClass] == undefined))
						continue; //didn't find 
					if (nodes[i].searchExp != undefined)
					{
						if (multipleNames)
						{
							for (name in curObj.relations[relation][nodes[i].theClass])
							{
								if (curObj.relations[relation][nodes[i].theClass].hasOwnProperty(name) && 
									typeof(curObj.relations[relation][nodes[i].theClass][name] !== 'function'))
								{
									foundNodes.push(curObj.relations[relation][nodes[i].theClass][name]);
								}
							}
						}
						else
						{
							if (curObj.relations[relation][nodes[i].theClass][nodes[i].searchExp] == undefined)
								continue;
							foundOne = true;
							curObj = curObj.relations[relation][nodes[i].theClass][nodes[i].searchExp];
							break outerLoop;
						}
					}
					else
					{
						if (multipleClasses)
						{
							for (className in curObj.relations[relation])
							{
								for (name in curObj.relations[relation][className])
								{
									if (curObj.relations[relation][className].hasOwnProperty(name) && 
										typeof(curObj.relations[relation][className][name] !== 'function'))
									{
										foundNodes.push(curObj.relations[relation][className][name]);
									}
								}
							}
						}
						else
						{
							for (name in curObj.relations[relation][nodes[i].theClass])
							{
								if (curObj.relations[relation][nodes[i].theClass].hasOwnProperty(name) && 
									typeof(curObj.relations[relation][nodes[i].theClass][name] !== 'function'))
								{
									curObj = curObj.relations[relation][nodes[i].theClass][name];
									foundOne = true;
									break outerLoop;
								}
							}
						}
					}
				}
				
				if (multipleNodes)
				{	
					if (foundNodes.length < 1)
						return false;
					else
						return foundNodes;
				}
				
				if (!foundOne)
					return false;
			}
		}
		return curObj;
	},
	
	firstDraw: function()
	{
		this.updateDrawing();
		this.drawn = true;
	},
	
	reDraw: function()
	{
		return this.eraseDrawing();
	},
	
	// must be used in the case of zooming ...
	updateDrawing: function()
	{
		this.invokeRelatedNodes('.draws-*', 'draw');
	},
	
	eraseDrawing: function()
	{
		this.drawn = false;
	},
	
	draw: function()
	{
		if (this.drawn)
			return this.updateDrawing();
		else
			return this.firstDraw();
	},
	
	drawOnlyIfDrawn: function()
	{
		if (this.drawn) return this.draw();
	},
	
	getCanvas: function()
	{
		if (this.canvas == undefined)
			return this.canvas = this.getNode(this.context).getCanvas();
		return this.canvas;
	},
	
	observe: function(eventName, func)
	{
		if (this.observedEvents == undefined)
			this.observedEvents = {};
	
		if (this.observedEvents[eventName] == undefined)
			this.observedEvents[eventName] = [];
		
		this.observedEvents[eventName].push(func);
	},
	
	fire: function(eventName, ev)
	{
		if (this.observedEvents == undefined)
			return;
		var i;
		
		if (this.observedEvents[eventName] != undefined)
		{
			for (i = 0; i < this.observedEvents[eventName].length; i++)
			{
				this.observedEvents[eventName][i](ev);
			}
		}
	}
});

var DCanvas = Class.create(DChartNode, {

	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'canvas';
		this.className = 'DCanvas';
	},
	
	processData: function()
	{		
		this.scale = this.getNode(this.context + '.contains-DScale:'+this.data.scale);
		this.axes = this.getNode(this.context + '.contains-DAxesGroup:'+this.data.axesGroup);
		this.addRelationToNode(this.scale, 'uses');
		this.addRelationToNode(this.axes, 'draws');
		
		this.updateConversionData();
	},
	
	setBaseSVGDocument: function(doc)
	{
		this.svg = doc;
	},
	
	getReferenceElement: function(refId)
	{
		return this.svg.getElementById(refId);
	},
	
	updateConversionData: function()
	{
		if (this.scale.updatedScale)
		{
			this.xRatio =  (this.data.width )/(this.scale.currentScale.xEnd - this.scale.currentScale.xStart);
			this.yRatio = -(this.data.height)/(this.scale.currentScale.yEnd - this.scale.currentScale.yStart);
		}
	},
	
	convertX: function(x)
	{
		return (x - this.scale.currentScale.xStart) * this.xRatio + this.data.x;
	},
	
	convertY: function(y)
	{
		return (y - this.scale.currentScale.yStart) * this.yRatio + this.data.y + this.data.height;
	},
	
	convertDX: function(dx)
	{
		return dx * this.xRatio;
	},
	
	convertDY: function(dy)
	{
		return dy * this.yRatio;
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.scale  == undefined) this.data.scale  = DCanvas.defaultData.scale;
		if (this.data.axes   == undefined) this.data.canvas = DCanvas.defaultData.canvas;
		if (this.data.x      == undefined) this.data.x      = DCanvas.defaultData.x;
		if (this.data.y      == undefined) this.data.y      = DCanvas.defaultData.y;
		if (this.data.width  == undefined) this.data.y      = DCanvas.defaultData.width;
		if (this.data.height == undefined) this.data.y      = DCanvas.defaultData.height;
	}
});

DCanvas.defaultData = {
	scale: 'scale',
	axesGroup: 'axes',
	x: 50,
	x: 50,
	y: 50,
	width: 200,
	height: 150
};

var DScale = Class.create(DChartNode, {

	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'scale';
			
		this.className = 'DScale';
	},
	
	processData: function()
	{
		this.updatedScale = false;
		this.refreshScale();
	},
	
	applyDefaultData: function ()
	{
		if (!this.data) this.data = {};
	
		if (this.data.xStart == undefined) this.data.xStart = DScale.defaultData.xStart;
		if (this.data.xEnd   == undefined) this.data.xEnd   = DScale.defaultData.xEnd;
		if (this.data.yStart == undefined) this.data.yStart = DScale.defaultData.yStart;
		if (this.data.yEnd   == undefined) this.data.yEnd   = DScale.defaultData.yEnd;
		
		if (!this.data.autoMargin) this.data.autoMargin = {};
		
		if ((this.data.xStart != 'auto') && (this.data.autoMargin.left == undefined))   this.data.autoMargin.left   = DScale.defaultData.autoMargin.left;
		if ((this.data.xEnd   != 'auto') && (this.data.autoMargin.right == undefined))  this.data.autoMargin.right  = DScale.defaultData.autoMargin.right;		
		if ((this.data.yStart != 'auto') && (this.data.autoMargin.bottom == undefined)) this.data.autoMargin.bottom = DScale.defaultData.autoMargin.bottom;
		if ((this.data.yEnd   != 'auto') && (this.data.autoMargin.top == undefined))    this.data.autoMargin.top    = DScale.defaultData.autoMargin.top;
	},
	
	/*updatedPoint(point)
	{
	},
	
	pointRemoved(point)
	{
	},*/
	
	refreshScale: function()
	{
		var canvases = this.getNode('.^uses-DCanvas:*');
		var i, j;
		
		this.maxX = undefined;
		this.maxY = undefined;
		this.minX = undefined;
		this.minY = undefined;
		
		for (i = 0; i < canvases.length; i ++)
		{
			var seriesGroups = canvases[i].getNode('.^uses-DSeriesGroup:*');			
			for (j = 0; j < seriesGroups.length; j++)
			{
				if (this.maxX == undefined)
				{
					this.maxX = seriesGroups[j].maxX;
					this.maxY = seriesGroups[j].maxY;
					this.minX = seriesGroups[j].minX;
					this.minY = seriesGroups[j].minY;
				}
				else
				{
					this.maxX = Math.max(seriesGroups[j].maxX, this.maxX);
					this.maxY = Math.max(seriesGroups[j].maxY, this.maxY);
					this.minX = Math.min(seriesGroups[j].minX, this.minX);
					this.minY = Math.min(seriesGroups[j].minY, this.minY);
				}
			}
		}
		
		if (this.maxX != undefined)
		{
			this.updateScaleAccordingToEnclosedPoints();
			this.invokeRelatedNodes('.^uses-DCanvas:*','updateConversionData');
			
			for (i = 0; i < canvases.length; i++)
			{
				canvases[i].invokeRelatedNodes('.draws-DAxesGroup:*', 'refreshTicks');
			
				canvases[i].drawOnlyIfDrawn();
				canvases[i].invokeRelatedNodes('.^uses-DSeriesGroup:*','drawOnlyIfDrawn');
			}
		}
	},
	
	updateScaleAccordingToEnclosedPoints: function()
	{
		var horizontalMargin = 0;
		var verticalMargin = 0;
		
		this.currentScale = {};
		
		if (this.data.xStart == 'auto') 
		{
			this.currentScale.xStart = this.minX;
			horizontalMargin += this.data.autoMargin.left;
		}
		else
			this.currentScale.xStart = this.data.xStart
		
		if (this.data.yStart == 'auto') 
		{
			this.currentScale.yStart = this.minY;
			verticalMargin += this.data.autoMargin.bottom;
		}
		else
			this.currentScale.yStart = this.data.yStart
		
		if (this.data.xEnd   == 'auto') 
		{
			this.currentScale.xEnd = this.maxX;
			horizontalMargin += this.data.autoMargin.right;
		}
		else
			this.currentScale.xEnd = this.data.xEnd;
				
		if (this.data.yEnd   == 'auto')
		{		
			this.currentScale.yEnd = this.maxY;
			verticalMargin += this.data.autoMargin.top;
		}
		else
			this.currentScale.yEnd = this.data.yEnd;
	
		var newWidth  = (this.currentScale.xEnd - this.currentScale.xStart) / (1 - horizontalMargin);
		var newHeight = (this.currentScale.yEnd - this.currentScale.yStart) / (1 - verticalMargin);
	
		if (this.data.xStart == 'auto')
			this.currentScale.xStart += -this.data.autoMargin.left * newWidth;
			
		if (this.data.xEnd == 'auto')
			this.currentScale.xEnd   += this.data.autoMargin.right * newWidth;
		
		if (this.data.yStart == 'auto')
			this.currentScale.yStart += -this.data.autoMargin.bottom * newHeight;
			
		if (this.data.yEnd == 'auto')
			this.currentScale.yEnd   += this.data.autoMargin.top * newHeight;
		
		this.updatedScale = true;
	}
});

DScale.defaultData = {
	xStart: 'auto',
	yStart: 'auto',
	xEnd: 'auto',
	yEnd: 'auto',
	autoMargin: {
		bottom: 0.1,
		top:   	0.2,
		left:  	0.1,
		right: 	0.1
	}
};

var DLabel = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'label';
		this.className = 'DLabel';
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
		if (this.data.options.display == undefined) this.data.options.display = DDot.defaultData.options.display;
		if (this.data.options.labelRef == undefined) this.data.options.labelRef = DLabel.defaultData.options.labelRef;
		if (this.data.attributes == undefined) this.data.attributes = {};
		if (this.data.attributes.display == undefined) this.data.attributes.display = DLabel.defaultData.attributes.display;

	},
	
	show: function()
	{
		this.data.options.display = true;
		this.updateDrawing();
	},
	
	hide: function()
	{
		this.data.options.display = false;
		this.updateDrawing();
	},
	
	firstDraw: function($super)
	{
		this.labelElement = this.getCanvas().svg.getElementById('point-label-ref').cloneNode(false);
		this.labelElementRef = this.getCanvas().svg.getElementById('point-label-ref');
		this.labelElement.id = "label-" + this.data.name;
		
		
		this.getCanvas().svg.getElementById('plot-1-labels').appendChild(this.labelElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{
		if (this.labelElement.lastChild)
			this.labelElement.removeChild(this.labelElement.lastChild);
		
		var dx = this.labelElementRef.getAttributeNS(null,'x') - this.getCanvas().svg.getElementById('point-ref').getAttributeNS(null,'cx');
		var dy = this.labelElementRef.getAttributeNS(null,'y') - this.getCanvas().svg.getElementById('point-ref').getAttributeNS(null,'cy');
		
		if (this.data.attributes.display == 'always')
		{
			isHighlight = (this.labelElement.getAttributeNS(null,"class").indexOf("highlight") != -1);
		
			this.labelElement.setAttributeNS(null,"class", "always-display " +this.labelElementRef.getAttributeNS(null,"class") + this.data.classes + (isHighlight ? " highlight" : ""));
		}
		
		if (this.data.options.display)
		{
			this.labelElement.setAttributeNS(null,"class", (this.labelElement.getAttributeNS(null,"class") + "").replace(" hidden","") + " shown");
		}
		else
		{
			this.labelElement.setAttributeNS(null,"class", (this.labelElement.getAttributeNS(null,"class") + "").replace(" shown","") + " hidden");
		}
		
		this.labelElement.setAttributeNS(null, "x", this.getCanvas().convertX(this.data.x) + dx);
		this.labelElement.setAttributeNS(null, "y", this.getCanvas().convertY(this.data.y) + dy);
		
		this.labelElement.appendChild(this.getCanvas().svg.createTextNode(this.data.labelCaption));
	},
	
	setHighlight: function(status)
	{
		if (status)
		{
			this.labelElement.setAttributeNS(null,"class", this.labelElement.getAttributeNS(null,"class") + " highlight");
		}
		else
		{
			this.labelElement.setAttributeNS(null,"class", this.labelElement.getAttributeNS(null,"class").replace(" highlight",""));
		}
	},
	
});

DLabel.defaultData = {
	options: {dotRef: 'point-label-ref', display: true},
	attributes: {display: 'highlight'}
};


var DDot = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'dot';
		this.className = 'DDot';
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
		if (this.data.options.display == undefined) this.data.options.display = DDot.defaultData.options.display;
		if (this.data.options.dotRef == undefined) this.data.options.dotRef = DDot.defaultData.options.dotRef;
		
	},

	show: function()
	{
		this.data.options.display = true;
		this.updateDrawing();
	},
	
	hide: function()
	{
		this.data.options.display = false;
		this.updateDrawing();
	},
	
	firstDraw: function($super)
	{
		this.dotElement = this.getCanvas().svg.getElementById('point-ref').cloneNode(true);
		this.dotElement.id = "dot-" + this.data.name;
	
		this.dotElement.addEventListener('mouseover', (function(ev) { this.fire('mouseover', ev)}).bind(this), false);
		this.dotElement.addEventListener('mouseout', (function(ev) { this.fire('mouseout', ev)}).bind(this), false);
		this.getCanvas().svg.getElementById('plot-1').appendChild(this.dotElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{
		this.dotElement.setAttributeNS(null, "cx", this.getCanvas().convertX(this.data.x));
		this.dotElement.setAttributeNS(null, "cy", this.getCanvas().convertY(this.data.y));
	
		if (this.data.color != undefined)
		{
			this.dotElement.setAttributeNS(null,"fill", this.data.color);
		}
		
		if (this.data.classes != undefined)
		{
			isHighlight = (this.dotElement.getAttributeNS(null,"class").indexOf("highlight") != -1);
			
			this.dotElement.setAttributeNS(null,"class", this.dotElement.getAttributeNS(null,"class") + " " + this.data.classes + " " + this.data.classes + (isHighlight ? " highlight" : ""));
		}
		
		if (this.data.options.display)
		{			
			this.dotElement.setAttributeNS(null,"class", (this.dotElement.getAttributeNS(null,"class") + "").replace(" hidden","") + " shown");
		}
		else
		{
			this.dotElement.setAttributeNS(null,"class", this.dotElement.getAttributeNS(null,"class").replace(" shown","") + " hidden");
		}
	},
	
	setHighlight: function(status)
	{
		if (status)
		{
			this.dotElement.setAttributeNS(null,"class", this.dotElement.getAttributeNS(null,"class") + " highlight");
		}
		else
		{
			this.dotElement.setAttributeNS(null,"class", this.dotElement.getAttributeNS(null,"class").replace(" highlight",""));
		}
	},
});

DDot.defaultData = {
	options: {dotRef: 'point-ref', display: true}
};

var DBar = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'abr';
		this.className = 'DBar';
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
		if (this.data.options.display == undefined) this.data.options.display = DBar.defaultData.options.display;
		if (this.data.options.barRef == undefined) this.data.options.barRef = DBar.defaultData.options.barRef;
	},
	
	show: function()
	{
		this.data.options.display = true;
		this.updateDrawing();
	},
	
	hide: function()
	{
		this.data.options.display = false;
		this.updateDrawing();
	},
	
	firstDraw: function($super)
	{
		this.barElement = this.getCanvas().svg.getElementById('bar-ref-1').cloneNode(true);
		this.barElement.id = "bar-" + this.data.name;
		
		this.barElement.addEventListener('mouseover', (function(ev) { this.fire('mouseover', ev)}).bind(this), false);
		this.barElement.addEventListener('mouseout', (function(ev) { this.fire('mouseout', ev)}).bind(this), false);
		this.getCanvas().svg.getElementById('plot-1').appendChild(this.barElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{
		var refElement1 = this.getCanvas().svg.getElementById('bar-ref-1');
		var refElement2 = this.getCanvas().svg.getElementById('bar-ref-2');
		
		var numberOfParallelBars;
		var currentBarOrder;
		
		switch (this.parentNode.parentNode.parentNode.data.options.multipleBars)
		{
			case 'parallel':
					numberOfParallelBars = this.parentNode.parentNode.parentNode.data.seriesCount;
					currentBarOrder = this.parentNode.parentNode.data.order;
				break;
			case 'pile':
					numberOfParallelBars = 1;
					currentBarOrder = 0;
				break;
		}
		
		var refWidth = refElement1.getAttributeNS(null, 'width');
		var refXOffset = (refElement1.getAttributeNS(null, 'x') - refElement2.getAttributeNS(null, 'x'));
	//	var percentXOffset = (refElement1.getAttributeNS(null, 'x') - this.getCanvas().svg.getElementById('xtick-ref').getAttributeNS(null,'x1'))/(refElement1.getAttributeNS(null, 'x') -  refElement2.getAttributeNS(null, 'x')) ;
		var percentBarWidth = (refXOffset - refWidth)/refWidth;
		
		var y  = this.getCanvas().convertY(this.data.y);
		var y0 = this.getCanvas().convertY(this.data.y0);
		
		var width = (1/(numberOfParallelBars + percentBarWidth)) * this.getCanvas().convertDX(1);
		
		this.barElement.setAttributeNS(null, 'width', width); // 1 is the default increment
		this.barElement.setAttributeNS(null, 'x', -((numberOfParallelBars*width)/2) + this.getCanvas().convertX(this.data.x) + (width * currentBarOrder));
		this.barElement.setAttributeNS(null, 'y', Math.min(y,y0));
		this.barElement.setAttributeNS(null, 'height', Math.abs(y0 - y) -  1); // minus 1 is a hack to compensate for the axis line -- horrendous hack
		
		if (this.data.color != undefined)
		{
			this.barElement.setAttributeNS(null,"fill", this.data.color);
			
			if (this.data.color2 != undefined && this.data.y < this.data.y0)
			{
				this.barElement.setAttributeNS(null,"fill", this.data.color2);
			}
		}
		
		if (this.data.classes != undefined)
		{
			this.barElement.setAttributeNS(null,"class", this.barElement.getAttributeNS(null,"class") + " " + this.data.classes);
		}
		
		if (this.data.options.display)
		{
			this.barElement.setAttributeNS(null,"class", (this.barElement.getAttributeNS(null,"class") + "").replace(" hidden","") + " shown");
		}
		else
		{
			this.barElement.setAttributeNS(null,"class", this.barElement.getAttributeNS(null,"class").replace(" shown","") + " hidden");
		}
	},
	
	/*setHighlight: function(status)
	{
		if (status)
		{
			this.dotElement.setAttributeNS(null,"class", this.dotElement.getAttributeNS(null,"class") + " highlight");
		}
		else
		{
			this.dotElement.setAttributeNS(null,"class", this.dotElement.getAttributeNS(null,"class").replace(" highlight",""));
		}
	},*/
});

DBar.defaultData = {
	options: {barRef: 'bar-ref-1', display: true}
};

var DArea = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'area';
		this.className = 'DArea';
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
		if (this.data.options.areaRef == undefined) this.data.options.areaRef = DArea.defaultData.options.areaRef;
	},
	
	firstDraw: function($super)
	{
		this.areaElement = this.getCanvas().svg.getElementById('area-ref').cloneNode(true);
		this.areaElement.id = "area-" + this.data.name;
		
		this.areaElement.addEventListener('mouseover', (function(ev) { this.fire('mouseover', ev)}).bind(this), false);
		this.areaElement.addEventListener('mouseout', (function(ev) { this.fire('mouseout', ev)}).bind(this), false);
		this.getCanvas().svg.getElementById('plot-1').appendChild(this.areaElement);
	
		$super();
	},
	
	setHighlight: function(status)
	{
		if (status)
		{
			this.areaElement.setAttributeNS(null,"class", this.areaElement.getAttributeNS(null,"class") + " highlight");
		}
		else
		{
			this.areaElement.setAttributeNS(null,"class", this.areaElement.getAttributeNS(null,"class").replace(" highlight",""));
		}
		
	},
	
	updateDrawing: function($super)
	{
		var pointsAttr = "";
		var i;
		for (i = 0; i < this.data.points.length; i++)
		{
			pointsAttr = ""  
					   + (this.getCanvas().convertX(this.data.points[i].x)) 
					   + ", "
					   + (this.getCanvas().convertY(this.data.points[i].y)) 
					   + " "
					   + pointsAttr
					   + " "
					   + (this.getCanvas().convertX(this.data.points[i].x)) 
					   + ", "
					   + (this.getCanvas().convertY(this.data.points[i].y2))
		}
		
		this.areaElement.setAttributeNS (null,"points", pointsAttr);
		if (this.data.color != undefined)
		{
			this.areaElement.setAttributeNS (null,"fill", this.data.color);
		}
		if (this.data.classes != undefined) 
		{
			this.areaElement.setAttributeNS(null,"class", this.getCanvas().svg.getElementById('area-ref').getAttributeNS(null,"class") + " " + this.data.classes);
		}
	}
});

DArea.defaultData = {
	options: {areaRef: 'area-ref'}
};

var DLine = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'line';
		this.className = 'DLine';
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
		if (this.data.options.display == undefined) this.data.options.display = DLine.defaultData.options.display;
		if (this.data.options.lineRef == undefined) this.data.options.lineRef = DLine.defaultData.options.lineRef;
	},
	
	show: function()
	{
		this.data.options.display = true;
		this.updateDrawing();
	},
	
	hide: function()
	{
		this.data.options.display = false;
		this.updateDrawing();
	},
	
	firstDraw: function($super)
	{
		this.lineElement = this.getCanvas().svg.getElementById('line-ref').cloneNode(true);
		this.lineElement.id = "line-" + this.data.name;
		
		this.lineElement.addEventListener('mouseover', (function(ev) { this.fire('mouseover', ev)}).bind(this), false);
		this.lineElement.addEventListener('mouseout', (function(ev) { this.fire('mouseout', ev)}).bind(this), false);
		this.getCanvas().svg.getElementById('plot-1').appendChild(this.lineElement);
	
		$super();
	},
	
	setHighlight: function(status)
	{
		if (status)
		{
			this.lineElement.setAttributeNS(null,"class", this.lineElement.getAttributeNS(null,"class") + " highlight");
		}
		else
		{
			this.lineElement.setAttributeNS(null,"class", this.lineElement.getAttributeNS(null,"class").replace(" highlight", ""));
		}
	},
	
	updateDrawing: function($super)
	{
		var pointsAttr = "";
		var i;
		for (i = 0; i < this.data.points.length; i++)
		{
			pointsAttr += ""  
					   + (this.getCanvas().convertX(this.data.points[i].x)) 
					   + ", "
					   + (this.getCanvas().convertY(this.data.points[i].y)) 
					   + " ";
		}
		
		this.lineElement.setAttributeNS (null,"points", pointsAttr);
		if (this.data.color != undefined)
		{
			this.lineElement.setAttributeNS (null,"stroke", this.data.color);
		}
		
		if (this.data.classes != undefined) 
		{
			isHighlight = ((this.lineElement.getAttributeNS(null,"class") + "").indexOf("highlight") != -1);
			
			this.lineElement.setAttributeNS(null,"class", this.getCanvas().svg.getElementById('line-ref').getAttributeNS(null,"class") + " " + this.data.classes + (isHighlight ? " highlight" : ""));
		}
		
		if (this.data.options.display)
		{
			this.lineElement.setAttributeNS(null,"class", (this.lineElement.getAttributeNS(null,"class") + "").replace(" hidden","") + " shown");
		}
		else
		{
			this.lineElement.setAttributeNS(null,"class", this.lineElement.getAttributeNS(null,"class").replace(" shown","") + " hidden");
		}
	}
});

DLine.defaultData = {
	options: {lineRef: 'line-ref', display: true}
};

var DVerticalMark = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'verticalMark';
		this.className = 'DVerticalMark';
	},
	
	applyDefaultData: function()
	{	
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
	},
	
	firstDraw: function($super)
	{
		this.markElement = this.getCanvas().svg.getElementById('vertical-mark-ref').cloneNode(true);
		this.markElement.id = "verticalMark" + this.data.name;
		
		this.getCanvas().svg.getElementById('plot-1').appendChild(this.markElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{
		var refElement = this.getCanvas().svg.getElementById('vertical-mark-ref');
		
		this.markElement.setAttributeNS(null,"x1", this.getCanvas().convertX(this.data.x));
		this.markElement.setAttributeNS(null,"x2", this.getCanvas().convertX(this.data.x));
		this.markElement.setAttributeNS(null,"y1", this.getCanvas().convertY(0));
		this.markElement.setAttributeNS(null,"y2", this.getCanvas().convertY(this.data.y));
		
		/*if (this.data.color != undefined)
		{
			this.barElement.setAttributeNS(null,"fill", this.data.color);
			
			if (this.data.color2 != undefined && this.data.y < this.data.y0)
			{
				this.barElement.setAttributeNS(null,"fill", this.data.color2);
			}
		}
		
		if (this.data.classes != undefined)
		{
			this.barElement.setAttributeNS(null,"class", this.dotElement.getAttributeNS(null,"class") + " " + this.data.classes);
		}*/
	},
});

DVerticalMark.defaultData = {
	options: {}
};


var DPoint = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'point';
		this.className = 'DPoint';
	},
	
	show: function()
	{
		this.data.display = true;
		this.invokeRelatedNodes('.draws-*', 'show');
	},
	
	hide: function()
	{
		this.data.display = false;
		this.invokeRelatedNodes('.draws-*', 'hide');
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.display == undefined) this.data.display = DPoint.defaultData.display;
		if (this.data.attributes == undefined) this.data.attributes = JSONcopy(DPoint.defaultData.attributes);
		
	},
	
	processData: function()
	{
		switch (this.parentNode.parentNode.data.type)
		{
			case 'verticalMarks':
				var hasPreviousPoint = false;
				var hasNextPoint = false;
				
			
				this.data.markData = {
					x: this.data.x,
				};
		
				this.referenceSerie = this.getNode('.^contains-DSerie.^contains-DSeriesGroup.^contains-DChart.contains-DSeriesGroup:'
						+ this.parentNode.data.baseSeriesGroup + '.contains-DSerie:' + this.parentNode.data.baseSerie);
				
				var i = 0;
				var previousPoint;
		
				for (; i < this.referenceSerie.data.points.length; i++)
				{
					if (this.data.x >= this.referenceSerie.data.points[i].x)
					{
					 	if (!hasPreviousPoint)
					 	{
					 		hasPreviousPoint = true;
					 		previousPoint = i;
					 	}
					 	else
					 	{
					 		if (Math.abs(this.referenceSerie.data.points[previousPoint].x - this.data.x) > Math.abs(this.referenceSerie.data.points[i].x - this.data.x))
					 		{
					 			previousPoint = i;
					 		}
					 	}
					}
			
					if (this.data.x <= this.referenceSerie.data.points[i].x)	
					{ 
					 	if (!hasNextPoint)
					 	{
					 		hasNextPoint = true;
					 		nextPoint = i;
					 	}
					 	else
					 	{
					 		if (Math.abs(this.referenceSerie.data.points[nextPoint].x - this.data.x) > Math.abs(this.referenceSerie.data.points[i].x - this.data.x))
					 		{
					 			nextPoint = i;
					 		}
					 	}
					}
				}
		
				if (hasPreviousPoint)
				{
					var pY;
					/*
					console.log(this.referenceSerie.data.points[previousPoint].y2); //15
					console.log((this.referenceSerie.data.points[nextPoint].y2 - this.referenceSerie.data.points[previousPoint].y2)); //3
					console.log((this.referenceSerie.data.points[nextPoint].x  - this.referenceSerie.data.points[previousPoint].x )); //1
					console.log((this.data.x - this.referenceSerie.data.points[previousPoint].x)); //0.3
			*/
			
			
					if (this.referenceSerie.data.points[previousPoint].y2 > this.referenceSerie.data.points[previousPoint].y)
						referenceIndex = "y2";
					else
						referenceIndex = "y";
			
					
					pY = this.referenceSerie.data.points[previousPoint][referenceIndex] 
							+ (
								(this.referenceSerie.data.points[nextPoint][referenceIndex] - this.referenceSerie.data.points[previousPoint][referenceIndex])
								/
								(this.referenceSerie.data.points[nextPoint].x  - this.referenceSerie.data.points[previousPoint].x )
							  )
							* (this.data.x - this.referenceSerie.data.points[previousPoint].x);
					  
					this.data.markData.y = pY;
				}
			break;
		}	
	},
	
	setHighlight: function(status)
	{
		switch (this.parentNode.parentNode.data.type)
		{
			case 'line':
				if (this.parentNode.data.options.dots)
                {
					this.invokeRelatedNodes('.draws-DDot','setHighlight', status);
					this.invokeRelatedNodes('.draws-DLabel','setHighlight', status);
				}
			break;
			case 'bar':
			/*TODO*/
			break;
		}
	},
	
	firstDraw: function($super) /* To rigid, data can't be unset */
	{
		var multiplier = 100; //POG - round the numbers!
		switch (this.parentNode.parentNode.data.type)
		{
			case 'line':
				dotData = {
					x: this.data.x,
					y: this.data.y,
					name: (this.getNode('.^contains.DSerie.^contains.DSeriesGroup')) + '-' + this.getNode('.^contains.DSerie').name + '-' + this.name,
					options: {display: this.data.display}
				};
				
				labelData = {
					x: this.data.x,
					y: this.data.y,
					labelCaption: Math.round(this.data.y * multiplier)/multiplier,
					name: (this.getNode('.^contains.DSerie.^contains.DSeriesGroup')) + '-' + this.getNode('.^contains.DSerie').name + '-' + this.name,
					options: {display: this.data.display}
				};
				
				if (this.data.attributes.color != undefined) 
					dotData.color = this.data.attributes.color;
					
				if (this.data.classes != undefined) 
					dotData.classes = this.data.classes; //Must merge classes with parent
				
				this.dot   = new DDot  (this, 'draws', dotData, 'oneDot');
				this.label = new DLabel(this, 'draws', labelData, 'oneLabel');
			break;
			case 'bar':
				barData = {
					x:  this.data.x,
					y0: this.getCanvas().scale.currentScale.yStart,
					y:  Math.round(this.data.y * multiplier)/multiplier,
					name: (this.getNode('.^contains.DSerie.^contains.DSeriesGroup')) + '-' + this.getNode('.^contains.DSerie').name + '-' + this.name
				};
				
				labelData = {
					x: this.data.x,
					y: this.data.y,
					labelCaption: this.data.y,
					attributes: {display: 'always'},
					name: (this.getNode('.^contains.DSerie.^contains.DSeriesGroup')) + '-' + this.getNode('.^contains.DSerie').name + '-' + this.name
				};
				
				if (this.data.attributes.color != undefined) 
					barData.color = this.data.attributes.color;
					
				if (this.data.classes != undefined) 
					barData.classes = this.data.classes; //Must merge classes with parent
				
				this.bar   = new DBar  (this, 'draws', barData, 'oneBar');
				this.label = new DLabel(this, 'draws', labelData, 'oneLabel');
			break;
			
			case 'intervalBar':
				barData = {
					x:  this.data.x,
					y0: Math.round(this.data.y  * multiplier)/multiplier,
					y: 	Math.round(this.data.y2 * multiplier)/multiplier,
					name: (this.getNode('.^contains.DSerie.^contains.DSeriesGroup')) + '-' + this.getNode('.^contains.DSerie').name + '-' + this.name
				};
				/* TODO: develop label for the interval bars */
				
				if (this.data.attributes.color != undefined) 
					barData.color = this.data.attributes.color;					
				
				//console.log("banana " +this.data.attributes.color2);
				if (this.data.attributes.color2 != undefined)
					barData.color2 = this.data.attributes.color2;
					
				if (this.data.classes != undefined) 
					barData.classes = this.data.classes; //Must merge classes with parent
				
				this.bar   = new DBar  (this, 'draws', barData, 'oneBar');
			break;
			
			case 'verticalMarks':
			
				if (this.data.markData == undefined)
					this.data.markData = {};
				
				if (this.data.attributes.color != undefined) 
					this.data.markData.color = this.data.attributes.color;
					
				if (this.data.classes != undefined) 
					this.data.markData.classes = this.data.classes;
				
				console.log("markData: ");
				console.log(this.data.markData);
				console.log(JSONcopy(this.data.markData));
				this.mark = new DVerticalMark (this, 'draws', this.data.markData, 'oneMark');
				
			break;
		}
	
		$super();
	},
});

DPoint.defaultData = {
	attributes: {},
	display: true
};

var DSerie = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'serie';
		this.className = 'DSerie';
	},
	
	processData: function()
	{
		this.createPoints();
		this.calculateMaxsAndMins();
		
		
		if (this.parentNode.data.legend != undefined)
		{
			this.getNode(this.context + '.uses-DLegend').addEntry(this, {
				caption: this.data.title,
				attributes: {
					color: this.data.attributes.color
				}
			});
		}

		this.areas = [];
	},
	
	show: function()
	{
		this.invokeRelatedNodes('.draws-*', 'show');
		this.invokeRelatedNodes('.contains-*', 'show');
	},
	
	hide: function()
	{
		this.invokeRelatedNodes('.draws-*', 'hide');
		this.invokeRelatedNodes('.contains-*', 'hide');
	},
	
	createPoints: function()
	{
		var i = 0;
		var pointData;
		
		for (; i < this.data.points.length; i++)
		{
			pointData = JSONcopy(this.data.points[i]);
			if (this.data.display == false)
			{
				pointData.display = this.data.display;
			}
			
			if (this.parentNode.data.type == 'verticalMarks')
			{
				console.log ('ponto do tipo verticalMark');
			}
			
			point = new DPoint(this, 'contains', pointData, i);
		}
	},
	
	calculateMaxsAndMins: function()
	{
		var i = 0;
		
		this.maxX = undefined;
		this.maxY = undefined;
		this.minX = undefined;
		this.minY = undefined;
		
		for (; i < this.data.points.length; i++)
		{	
			if (this.maxX == undefined)
			{
				this.maxX = this.data.points[i].x;
				this.maxY = this.data.points[i].y;
				this.minX = this.data.points[i].x;
				this.minY = this.data.points[i].y;
				
				if (this.data.points[i].y2 != undefined)
				{
					this.minY = Math.min(this.data.points[i].y2, this.minY);
					this.maxY = Math.max(this.data.points[i].y2, this.maxY);
				}
			}
			else
			{
				this.maxX = Math.max(this.data.points[i].x, this.maxX);
				this.maxY = Math.max(this.data.points[i].y, this.maxY);
				this.minX = Math.min(this.data.points[i].x, this.minX);
				this.minY = Math.min(this.data.points[i].y, this.minY);
				
				if (this.data.points[i].y2 != undefined)
				{
					this.minY = Math.min(this.data.points[i].y2, this.minY);
					this.maxY = Math.max(this.data.points[i].y2, this.maxY);
				}
			}
		}
	},
	
	updateDrawing: function($super)
	{
		this.invokeRelatedNodes('.contains-DPoint:*','draw');
		
		$super();
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.display == undefined)      this.data.display = DSerie.defaultData.display;
		if (this.data.options == undefined)      this.data.options = {};
        if (this.data.options.line == undefined) this.data.options.line = DSerie.defaultData.options.line;
        if (this.data.options.dots == undefined) this.data.options.dots = DSerie.defaultData.options.dots;
		if (this.data.points     == undefined)   this.data.points     = JSONcopy(DSerie.defaultData.points);
		if (this.data.attributes == undefined)   this.data.attributes = JSONcopy(DSerie.defaultData.attributes);
		if (this.data.title      == undefined)   this.data.title      = this.name;
		
		var i;
		if (this.data.attributes.color != undefined)
		{
			for (i = 0; i < this.data.points.length; i++)
			{
				if (this.data.points[i].attributes == undefined)
					this.data.points[i].attributes = {};
				if (this.data.points[i].attributes.color == undefined)
					this.data.points[i].attributes.color = this.data.attributes.color;
				if (this.data.points[i].attributes.color2 == undefined)
					this.data.points[i].attributes.color2 = this.data.attributes.color2;
			}
		}
	},
	
	firstDraw: function($super)
	{
		if (this.parentNode.data.type == 'line' && this.data.options.line)
		{
			lineData = {
				points:  this.data.points, 
				name:    this.getNode('.^contains.DSerie.^contains.DSeriesGroup') + '-' + this.name,
				options: {
					display: this.data.display
				}
			};

			if (this.data.attributes.color != undefined) 
				lineData.color = this.data.attributes.color;
				
			if (this.data.classes != undefined) 
				lineData.classes = this.data.classes; //Must merge classes with parent

			this.line = new DLine(this, 'draws', lineData, 'oneLine');
			this.line.observe('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
			this.line.observe('mouseout', (function(ev) { this.fire('endhighlight', ev)}).bind(this), false);
		}
		else if (this.parentNode.data.type == 'area')
		{
			areaData = {
				points: this.data.points, 
				name: this.getNode('.^contains.DSerie.^contains.DSeriesGroup') + '-' + this.name
			};

			if (this.data.attributes.color != undefined) 
				areaData.color = this.data.attributes.color;
				
			if (this.data.classes != undefined) 
				areaData.classes = this.data.classes; //Must merge classes with parent

			this.area = new DArea(this, 'draws', areaData, 'oneArea');
			this.area.observe('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
			this.area.observe('mouseout', (function(ev) { this.fire('endhighlight', ev)}).bind(this), false);
		
		}
//test alex POG
		if (this.parentNode.data.type == 'intervalArea')
		{	
			var i;
			var areaIdx = 0;
			var lastDiff;
			var newDiff;

			areaData = {
				points: [],
				name: 'area' + areaIdx
			};
			
/////////	
			lastDiff = this.data.points[0].y2 - this.data.points[0].y;

			if (lastDiff < 0)
			{
				if (this.data.attributes.color != undefined) 
					areaData.color = this.data.attributes.color;
			}
			else
			{
				if (this.data.attributes.color2 != undefined) 
					areaData.color = this.data.attributes.color2;
				else if (this.data.attributes.color != undefined) 
					areaData.color = this.data.attributes.color;
			}

			if (this.data.classes != undefined) 
				areaData.classes = this.data.classes;

			areaData.points.push(this.data.points[0]);

	
///////
			for (i = 1; i < this.data.points.length; i++)
			{	
				newDiff = this.data.points[i].y2 - this.data.points[i].y;

				if ((newDiff >= 0 && lastDiff < 0) || (newDiff < 0 && lastDiff >= 0))
				{
					var pX, pY, alpha, curPoint, lastPoint;

					curPoint = this.data.points[i];
					lastPoint = this.data.points[i-1];

					alpha = ((curPoint.y2 - lastPoint.y2)/(curPoint.x - lastPoint.x)) 
							- ((curPoint.y - lastPoint.y)/(curPoint.x - lastPoint.x));

					pX = lastPoint.x + (lastPoint.y - lastPoint.y2)/alpha;
					pY = lastPoint.y2 + (((curPoint.y2 - lastPoint.y2)/(curPoint.x - lastPoint.x))) * (pX - lastPoint.x);

					areaData.points.push({x: pX, y: pY, y2: pY});
			
					this.areas.push(new DArea(this, 'draws', areaData, 'areaInterval' + areaIdx));

					this.areas[areaIdx].observe('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
					this.areas[areaIdx].observe('mouseout', (function(ev) { this.fire('endhighlight', ev)}).bind(this), false);


					areaIdx++;					
					areaData = {
						points: [],
						name: 'area-' + areaIdx
					};

					if (newDiff < 0)
					{
						if (this.data.attributes.color != undefined) 
							areaData.color = this.data.attributes.color;
					}
					else
					{
						if (this.data.attributes.color2 != undefined) 
							areaData.color = this.data.attributes.color2;
						else if (this.data.attributes.color != undefined) 
							areaData.color = this.data.attributes.color;
					}

					if (this.data.classes != undefined) 
						areaData.classes = this.data.classes;
					areaData.points.push({x: pX, y: pY, y2: pY});

				}
				areaData.points.push(this.data.points[i]);
				lastDiff = newDiff;
			}
			this.areas.push(new DArea(this, 'draws', areaData, 'areaInterval-' + areaIdx));

			this.areas[areaIdx].observe('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
			this.areas[areaIdx].observe('mouseout', (function(ev) { this.fire('endhighlight', ev)}).bind(this), false);
		}


//// arrives
		if (this.parentNode.data.legend != undefined)
		{
			this.getNode('.adds-DLegendEntry').observe('starthighlight', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
			this.getNode('.adds-DLegendEntry').observe('endhighlight', (function(ev) { this.fire('endhighlight', ev)}).bind(this), false);
		}
		
		this.observe('starthighlight', (function(ev) { 
			this.setHighlight(true);
			if (this.parentNode.data.legend != undefined)
			{
				this.getNode('.adds-DLegendEntry').setHighlight(true);
			}
		}).bind(this));
		
		this.observe('endhighlight', (function(ev) { 
			this.setHighlight(false);
			if (this.parentNode.data.legend != undefined)
			{
				this.getNode('.adds-DLegendEntry').setHighlight(false);
			}
		}).bind(this));
	
		$super();
	},
	
	setHighlight: function (status)
	{
		if (this.parentNode.data.type == 'line' && this.data.options.line)
		{
			this.invokeRelatedNodes('.draws-DLine','setHighlight', status);
		}
		else if (this.parentNode.data.type == 'area')
		{
			this.invokeRelatedNodes('.draws-DArea','setHighlight', status);
		}
		
		this.invokeRelatedNodes('.contains-DPoint:*','setHighlight', status);
	}
});

DSerie.defaultData = {
	points:	[],
	attributes: {
		referenceColor: "#55DDDD",
	},
	options: {line: true, dots: true},
	display: true
};


var DSeriesGroup = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'seriesGroup';
		this.className = 'DSeriesGroup';
	},
	
	processData: function()
	{
		this.canvas = this.getNode(this.context + '.contains-DCanvas:' + this.data.canvas);
		
		this.addRelationToNode(this.canvas, 'uses');
		if (this.data.legend != undefined)
			this.addRelationToNode(this.getNode(this.context + '.contains-DLegend:' + this.data.legend), 'uses');
		
		this.createSeries();
		this.calculateMaxsAndMins();
		
		this.getNode(this.context + '.contains-DCanvas:' + this.data.canvas + '.uses-DScale').refreshScale();
	},
	
	createSeries: function()
	{
		var i;
		var q = 0;
		var serieData = {};
		
		for (i in this.data.series)
		{
			serieData = JSONcopy(this.data.series[i]);
			serieData.order = q;
			
			serie = new DSerie(this, 'contains', JSONcopy(serieData), i);
			q++;
		}
		
		this.data.seriesCount = q;
	},
	
	calculateMaxsAndMins: function()
	{
		var i;
		this.maxX = undefined;
		this.maxY = undefined;
		this.minX = undefined;
		this.minY = undefined;
		
		for (i in this.relations.contains.DSerie)
		{
			if (this.maxX == undefined)
			{
				this.maxX = this.relations.contains.DSerie[i].maxX;
				this.maxY = this.relations.contains.DSerie[i].maxY;
				this.minX = this.relations.contains.DSerie[i].minX;
				this.minY = this.relations.contains.DSerie[i].minY;
			}
			else
			{
				this.maxX = Math.max(this.relations.contains.DSerie[i].maxX, this.maxX);
				this.maxY = Math.max(this.relations.contains.DSerie[i].maxY, this.maxY);
				this.minX = Math.min(this.relations.contains.DSerie[i].minX, this.minX);
				this.minY = Math.min(this.relations.contains.DSerie[i].minY, this.minY);
			}
		}
	},
	
	updateDrawing: function($super)
	{
		this.invokeRelatedNodes('.contains-DSerie:*','draw');
		
		$super();
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.type   == undefined) this.data.type = DSeriesGroup.defaultData.type;
		if (this.data.canvas == undefined) this.data.canvas = DSeriesGroup.defaultData.canvas;
		if (this.data.series == undefined) this.data.series = JSONcopy(DSeriesGroup.defaultData.series);
		if (this.data.options == undefined) this.data.options = {};
		
		if (this.data.type == 'intervalBar')
		{
			if (this.data.options.multipleBars == undefined) this.data.options.multipleBars = DSeriesGroup.defaultData.options.multipleBars;
		}
	}
	
});

DSeriesGroup.defaultData = {
	type: 'line',
	canvas: 'canvas',
	legend: 'legend',
	series: {},
	options: {multipleBars: 'pile'}
};

var DRuler = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'ruler';
		this.className = 'DRuler';
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options     == undefined) this.data.options = {}; /*TODO*/
		
		if (this.data.orientation == undefined) this.data.orientation = 'x';
	},
	
	firstDraw: function($super)
	{
		this.rulerElement = this.getCanvas().svg.getElementById(this.data.orientation + '-axis-ref').cloneNode(true);
		this.rulerElement.id = "ruler-" + this.data.orientation; //include the own element
		
		this.getCanvas().svg.getElementById('plot-1').appendChild(this.rulerElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{	
		if (this.data.orientation == 'x')
		{
			this.rulerElement.setAttributeNS(null, "x1", this.getCanvas().data.x);
			this.rulerElement.setAttributeNS(null, "x2", this.getCanvas().data.x + this.getCanvas().data.width);
			this.rulerElement.setAttributeNS(null, "y1", this.getCanvas().data.y + this.getCanvas().data.height);
			this.rulerElement.setAttributeNS(null, "y2", this.getCanvas().data.y + this.getCanvas().data.height);
		}
		else
		{
			this.rulerElement.setAttributeNS(null, "x1", this.getCanvas().data.x);
			this.rulerElement.setAttributeNS(null, "x2", this.getCanvas().data.x);
			this.rulerElement.setAttributeNS(null, "y1", this.getCanvas().data.y);
			this.rulerElement.setAttributeNS(null, "y2", this.getCanvas().data.y + this.getCanvas().data.height);
		}
	}

});

var DTickBar = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'tickBar';
		this.className = 'DTickBar';
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
		if (this.data.options.tickBarRef == undefined) this.data.options.tickBarRef = DTickBar.defaultData.options.tickBarRef;
		if (this.data.orientation == undefined) this.data.orientation = this.parentNode.data.orientation;
	},
	
	firstDraw: function($super)
	{
		this.tickBarElement  = this.getCanvas().svg.getElementById(this.data.orientation + 'bar-ref').cloneNode(false);
		this.tickBarElement.id = this.data.orientation + "-bar-" + this.parentNode.name + '-' + this.name;
		
		this.getCanvas().svg.getElementById('bars-n-ticks').appendChild(this.tickBarElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{
		var refElement = this.getCanvas().svg.getElementById(this.data.orientation+'tick-label-ref');
		var otherOrientation = this.data.orientation == 'x' ? 'y' : 'x';		
		var	labelDisplacement;
		var convertFuncName = "convert" + ("-" +this.data.orientation).camelize();
		var maxOrMinFunc;
		var extensionFactor;
		var offset;
		var display = true;
		var text;
		var axisDisplacement;
		var barExtension;
		
		
		
		if (this.data.orientation == 'y')
		{
			maxOrMinFunc = Math.max;
			extensionFactor = -1;
			offset = 0;
			extensionName = 'height';
			barExtension = this.getCanvas().data.width;
		}
		else
		{
			maxOrMinFunc = Math.min;
			extensionFactor = 1;
			offset = this.getCanvas().data.height;
			barExtension = this.getCanvas().data.height;
			extensionName = 'width';
		}
		
		if (this.getCanvas()[convertFuncName](this.data.value) < this.getCanvas().data[this.data.orientation]
			|| this.getCanvas()[convertFuncName](this.data.value) > this.getCanvas().data[this.data.orientation] + this.getCanvas().data[extensionName])
			this.tickBarElement.setAttributeNS(null, 'display', 'none');
		else
			this.tickBarElement.setAttributeNS(null, 'display', 'block');
					
		this.tickBarElement.setAttributeNS(null, this.data.orientation + "1", this.getCanvas()[convertFuncName](this.data.value));
		this.tickBarElement.setAttributeNS(null, this.data.orientation + "2", this.getCanvas()[convertFuncName](this.data.value));
		
		this.tickBarElement.setAttributeNS(null, otherOrientation + "1", this.getCanvas().data[otherOrientation]);
		this.tickBarElement.setAttributeNS(null, otherOrientation + "2", this.getCanvas().data[otherOrientation] + barExtension);
		
		$super();
	}
});

DTickBar.defaultData = {
	options: {tickBarRef: "ybar-ref"}
};

var DTickLabel = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'tickLabel';
		this.className = 'DTickLabel';
	},
	
	processData: function()
	{
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
		if (this.data.options.tickLabelRef == undefined) this.data.options.tickLabelRef = DTickLabel.defaultData.options.tickLabelRef;
		if (this.data.orientation == undefined) this.data.orientation = this.parentNode.data.orientation;
	},
	
	firstDraw: function($super)
	{
		this.tickLabelElement = this.getCanvas().svg.getElementById(this.data.orientation + 'tick-label-ref').cloneNode(false);
		this.tickLabelElement.id = this.data.orientation + "-tick-label-" + this.parentNode.name + '-' + this.name;
		
		this.getCanvas().svg.getElementById('bars-n-ticks').appendChild(this.tickLabelElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{
		var refElement = this.getCanvas().svg.getElementById(this.data.orientation+'tick-label-ref');
		var otherOrientation = this.data.orientation == 'x' ? 'y' : 'x';		
		var	labelDisplacement;
		var convertFuncName = "convert" + ("-" +this.data.orientation).camelize();
		var offset;
		var display = true;
		var text;
		var axisDisplacement;
		
		if (this.data.orientation == 'y')
		{
			offset = 0;
			extensionName = 'height';
		}
		else
		{
			offset = this.getCanvas().data.height;
			extensionName = 'width';
		}
		
		if (this.data.labelCaption != undefined)
			text = this.data.labelCaption;
		else
		{
			multiplier = 10000000;
			text = Math.round(this.data.value * multiplier)/multiplier;
		}
		
		axisDisplacement = refElement.getAttributeNS(null, otherOrientation) - this.getCanvas().svg.getElementById(this.data.orientation + '-axis-ref').getAttributeNS(null, otherOrientation + "1");
		labelDisplacement = refElement.getAttributeNS(null, this.data.orientation) - this.getCanvas().svg.getElementById(this.data.orientation + 'tick-ref').getAttributeNS(null, this.data.orientation + "1");
		
		if (this.tickLabelElement.lastChild)
			this.tickLabelElement.removeChild(this.tickLabelElement.lastChild);
		
		this.tickLabelElement.appendChild(this.getCanvas().svg.createTextNode(text));
		
		this.tickLabelElement.setAttributeNS(null, this.data.orientation, this.getCanvas()[convertFuncName](this.data.value) + labelDisplacement);
		this.tickLabelElement.setAttributeNS(null, otherOrientation, this.getCanvas().data[otherOrientation] + offset + axisDisplacement);

		if (this.getCanvas()[convertFuncName](this.data.value) < this.getCanvas().data[this.data.orientation]
			|| this.getCanvas()[convertFuncName](this.data.value) > this.getCanvas().data[this.data.orientation] + this.getCanvas().data[extensionName])
			this.tickLabelElement.setAttributeNS(null, 'display', 'none');
		else
			this.tickLabelElement.setAttributeNS(null, 'display', 'block');
		
		$super();
	}
});

DTickLabel.defaultData = {
	options: {tickLabelRef: "ytick-label-ref"}
};


var DTick = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'tick';
		this.className = 'DTick';
	},
	
	processData: function()
	{
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.options == undefined) this.data.options = {};
		if (this.data.options.tickRef == undefined) this.data.options.tickRef = DTick.defaultData.options.tickRef;
		if (this.data.orientation == undefined) this.data.orientation = this.parentNode.data.orientation;
	},
	
	firstDraw: function($super)
	{
		this.tickElement = this.getCanvas().svg.getElementById(this.data.orientation + 'tick-ref').cloneNode(true);
		this.tickElement.id = this.data.orientation + "-tick-" + this.name;
		
		this.getCanvas().svg.getElementById('bars-n-ticks').appendChild(this.tickElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{
		var refElement = this.getCanvas().svg.getElementById(this.data.orientation + 'tick-ref');
		var otherOrientation = this.data.orientation == 'x' ? 'y' : 'x';		
		var	tickDisplacement;
		var tickExtension = Math.abs(refElement.getAttributeNS(null, otherOrientation + "2") - refElement.getAttributeNS(null, otherOrientation + "1"));
		var convertFuncName = "convert" + ("-" +this.data.orientation).camelize();
		var maxOrMinFunc;
		var extensionFactor;
		var offset;
		var display = true;
		
		if (this.data.orientation == 'y')
		{
			maxOrMinFunc = Math.max;
			extensionFactor = -1;
			offset = 0;
			extensionName = 'height';
		}
		else
		{
			maxOrMinFunc = Math.min;
			extensionFactor = 1;
			offset = this.getCanvas().data.height;
			extensionName = 'width';
		}
		
		tickDisplacement = this.getCanvas().svg.getElementById(this.data.orientation+'-axis-ref').getAttributeNS(null, otherOrientation + "1") 
			- maxOrMinFunc(refElement.getAttributeNS(null, otherOrientation + "2"), refElement.getAttributeNS(null, otherOrientation + "1"));


		if (this.getCanvas()[convertFuncName](this.data.value) < this.getCanvas().data[this.data.orientation]
			|| this.getCanvas()[convertFuncName](this.data.value) > this.getCanvas().data[this.data.orientation] + this.getCanvas().data[extensionName])
			this.tickElement.setAttributeNS(null, 'display', 'none');
		else
			this.tickElement.setAttributeNS(null, 'display', 'block');
		
		this.tickElement.setAttributeNS(null, this.data.orientation + "1", this.getCanvas()[convertFuncName](this.data.value));
		this.tickElement.setAttributeNS(null, this.data.orientation + "2", this.getCanvas()[convertFuncName](this.data.value));
		this.tickElement.setAttributeNS(null, otherOrientation + "1", this.getCanvas().data[otherOrientation] + offset + (extensionFactor * tickExtension) - tickDisplacement);
		this.tickElement.setAttributeNS(null, otherOrientation + "2", this.getCanvas().data[otherOrientation] + offset - tickDisplacement);
		
		$super();
	}
});

DTick.defaultData = {
	options: {tickRef: "x-tick-ref"}
};

var DTickItem = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'tickItem';
		this.className = 'DTickItem';
	},
	
	processData: function()
	{
		if (this.data.tick)
			this.tick = new DTick(this, 'draws', this.data);
		if (this.data.label)
			this.label = new DTickLabel(this, 'draws', this.data);
		if (this.data.bar)
			this.label = new DTickBar(this, 'draws', this.data);
	},
	
	applyDefaultData: function()
	{		
		if (this.data.bar         == undefined) this.data.bar    = DTickItem.defaultData.bar;
		if (this.data.tick        == undefined) this.data.tick   = DTickItem.defaultData.tick;
		if (this.data.label       == undefined) this.data.label  = DTickItem.defaultData.label;
		if (this.data.anchor      == undefined) this.data.anchor = DTickItem.defaultData.anchor;
		if (this.data.orientation == undefined) this.data.orientation = this.parentNode.data.orientation;
	},
});

DTickItem.defaultData = {
	bar:    true, 
	tick:   true, 
	label:  true, 
	anchor: 'default',
};

var DTickGenerator = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'tickGenerator';
		this.className = 'DTickGenerator';
	},
	
	getScale: function()
	{
		return this.parentNode.getNode('.^contains-DAxesGroup.^draws-DCanvas.uses-DScale');
	},
	
	processData: function()
	{
		var scale = this.getScale();
		
		if (scale)
			this.scale.refreshScale();
	},
	
	refreshTicks: function()
	{
		if (this.getScale())
		{
			this.calcTickItems();
			
			var i;
			var theDTickItem;
			for (i = 0; i < this.tickItems.length; i++)
			{
				theDTickItem = new DTickItem(this.parentNode, 'draws', this.tickItems[i],"generated_"+ this.name +"_" + i);
				this.addRelationToNode(theDTickItem, 'generates');
			}
		}
	},
	
	calcTickItems: function()
	{
		this['calcTickItems'+ ("-"+this.data.algorithm).camelize()]();
	},
	
	bestFitIncrement: function (wantedQtt, extension)
	{
		var exponent;
		var bestIncrementTillNow = this.data.tickIncrementBases[0] * Math.pow(10, 0); //Starting with nothing
		var perfectFitIncrement = extension/(wantedQtt - 1);
		
		var i;
		
		for (i = 0; i < this.data.tickIncrementBases.length; i++)
		{
			exponent = Math.log(perfectFitIncrement/this.data.tickIncrementBases[i])/Math.log(10);
			
			if (Math.abs(this.data.tickIncrementBases[i] * Math.pow(10, Math.ceil(exponent)) - perfectFitIncrement) < Math.abs(bestIncrementTillNow - perfectFitIncrement))
			{
				bestIncrementTillNow = this.data.tickIncrementBases[i] * Math.pow(10, Math.ceil(exponent));
			}
			
			if (Math.abs(this.data.tickIncrementBases[i] * Math.pow(10, Math.floor(exponent)) - perfectFitIncrement) < Math.abs(bestIncrementTillNow - perfectFitIncrement))
			{
				bestIncrementTillNow = this.data.tickIncrementBases[i] * Math.pow(10, Math.floor(exponent));
			}
		}
		
		return bestIncrementTillNow;
	},
	
	calcTickItemsQuantity: function()
	{
		scale = this.getScale();
		axis = this.parentNode.data.orientation;
		
		var q = this.data.idealTicks;
		var extension = scale.currentScale[axis + 'End'] - scale.currentScale[axis + 'Start'];
		var interval  = this.bestFitIncrement(q, extension);
		
		this.tickItems = [];
		var i;
		var j;
		var newTick;
		
		for (i = -1; i < Math.ceil(1 + extension/interval); i++)
		{
			if (this.data.ignoreList && (this.data.ignoreList.indexOf(i) != -1)) 
				continue;
			
			newTick = JSONcopy(this.data.tickTemplates[(i + this.data.tickTemplates.length) % this.data.tickTemplates.length]);
			
			newTick.value = (Math.ceil(scale.currentScale[axis + 'Start'] / interval) + i) * interval;
			
			this.tickItems.push(newTick);
		}
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.algorithm == undefined) this.data.algorithm = DTickGenerator.defaultData.algorithm;
		
		if (this.data.algorithm == 'quantity')
		{			
			if (this.data.idealTicks == undefined) this.data.idealTicks = DTickGenerator.defaultData.quantity.idealTicks;
			if (this.data.tickTemplates == undefined) this.data.tickTemplates = JSONcopy(DTickGenerator.defaultData.quantity.tickTemplates);
			if (this.data.tickIncrementBases == undefined) this.data.tickIncrementBases = JSONcopy(DTickGenerator.defaultData.quantity.tickIncrementBases);
		}
	},
});

DTickGenerator.defaultData = {
	algorithm: 'quantity',
};

DTickGenerator.defaultData.quantity = {
	idealTicks: 8,
	tickTemplates: [
		{bar: true, tick:  true, label:  true, anchor: 'default'},
		{bar: true, tick: false, label: false, anchor: 'default'},
	],
	tickIncrementBases: [1, 2, 2.5, 4, 5],
};

var DAxisLabel = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'axisLabel';
		this.className = 'DAxisLabel';
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.orientation == undefined) this.data.orientation = DAxisLabel.defaultData.orientation;
		
		if (this.data.axisLabelRef == undefined)
		{
			this.data.axisLabelRef = this.data.orientation + '-axis-label';
		}
	},
	
	firstDraw: function($super)
	{
		this.axisLabelElement = this.getCanvas().svg.getElementById(this.data.axisLabelRef).cloneNode(false);
		this.axisLabelElementRef = this.getCanvas().svg.getElementById(this.data.axisLabelRef);
		this.axisLabelElement.id = this.data.orientation + "-axis-label-" + this.data.name;
		
		this.axisElementRef = this.getCanvas().svg.getElementById(this.data.orientation + "-axis-ref"); //TODO: make this flexible if the axis uses a different reference element
		
		this.getCanvas().svg.getElementById('plot-1-labels').appendChild(this.axisLabelElement);
	
		$super();
	},
	
	updateDrawing: function($super)
	{
		if (this.axisLabelElement.lastChild)
			this.axisLabelElement.removeChild(this.axisLabelElement.lastChild);
		
		//Assuming the label is centered around the axis ruler -- TODO: make this flexible
		var dx;
		var dy;
		var x;
		var y;
		
		
		var currentScale = this.getCanvas().getNode('.uses-DScale').currentScale;
		
	//	console.log(this.data.orientation);
	//	console.log(this.axisElementRef);
		
		if (this.data.orientation == 'y')
		{
			dx = this.axisLabelElementRef.getAttributeNS(null,'x') - this.axisElementRef.getAttributeNS(null,'x1');
			dy = this.axisLabelElementRef.getAttributeNS(null,'y') - (Math.min(this.axisElementRef.getAttributeNS(null,'y1'),this.axisElementRef.getAttributeNS(null,'y2'))  + Math.abs((this.axisElementRef.getAttributeNS(null,'y2') - this.axisElementRef.getAttributeNS(null,'y1'))/2));
		
			x = dx + this.getCanvas().convertX(currentScale.xStart);
			y = dy + this.getCanvas().convertY(currentScale.yStart + (currentScale.yEnd - currentScale.yStart)/2);
		
		}
		else
		{
			dy = this.axisLabelElementRef.getAttributeNS(null,'y') - this.axisElementRef.getAttributeNS(null,'y1');
			dx = this.axisLabelElementRef.getAttributeNS(null,'x') - ((Math.min(this.axisElementRef.getAttributeNS(null,'x1'),this.axisElementRef.getAttributeNS(null,'x2'))  + Math.abs((this.axisElementRef.getAttributeNS(null,'x2') - this.axisElementRef.getAttributeNS(null,'x1'))/2)));
		
			y = dy + this.getCanvas().convertY(currentScale.yStart);
			x = dx + this.getCanvas().convertX(currentScale.xStart + (currentScale.xEnd - currentScale.xStart)/2);
		}
		
	//	console.log(dx);
	//	console.log(dy);
		

	//	console.log(x);
	//	console.log(y);
		
		this.axisLabelElement.setAttributeNS(null, "x", x);
		this.axisLabelElement.setAttributeNS(null, "y", y);
		
		var rotationAttr = this.axisLabelElementRef.getAttributeNS(null,'transform');
		
		parsedRotationAttr = rotationAttr.match(/(.*rotate *\( *[\-0-9]+ *, *)([\-0-9]+)( *, *)([\-0-9]+)(.*)/);
		
		rotationAttr = parsedRotationAttr[1] + x + parsedRotationAttr[3] + y + parsedRotationAttr[5];
		
		this.axisLabelElement.setAttributeNS(null, "transform", rotationAttr);
		
		this.axisLabelElement.appendChild(this.getCanvas().svg.createTextNode(this.data.caption));
	},
});

DAxisLabel.defaultData = {
	orientation: 'x'
};

var DAxis = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'axis';
		this.className = 'DAxis';
	},
	
	processData: function()
	{
		var i = 0;
		
		// UGLY POG
		if (this.name == 'xAxis')
			this.data.orientation = 'x';
		else
			this.data.orientation = 'y';
		
		if (this.data.tickGenerators != undefined)
			for (; i < this.data.tickGenerators.length; i++)
			{
				new DTickGenerator(this, 'contains', this.data.tickGenerators[i], i);
			}
		
		if (this.data.tickItems != undefined)
			for (i = 0; i < this.data.tickItems.length; i++)
			{
				new DTickItem(this, 'draws', this.data.tickItems[i],"custom_" + i);
			}
		
		if (this.data.label != undefined)
		{
			var labelData = JSONcopy(this.data.label);
			labelData.orientation = this.data.orientation;

			if (!Prototype.Browser.IE)
				new DAxisLabel(this, 'draws', labelData, i);
		}
	},
	
	refreshTicks: function()
	{
		if (this.getNode('.DTickGenerator'))
			this.invokeRelatedNodes('.DTickGenerator:*', 'refreshTicks');
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.tickGenerators == undefined)
		{
			if (this.data.tickItems == undefined)
				this.data.tickGenerators = [JSONcopy(DAxis.defaultTickGenerator)];
			else
				this.data.tickGenerators = JSONcopy(DAxis.defaultData.tickGenerators);
		}
		
		if (this.data.tickItems == undefined) this.data.tickItems = JSONcopy(DAxis.defaultData.tickItems);
		
		if (this.data.tickGenerators.length < 1 && this.data.tickItems.length < 1) this.data.tickGenerators 
	},
	
	firstDraw: function($super)
	{	
		this.ruler = new DRuler(this, 'draws', {orientation: this.data.orientation}, this.data.orientation + '-ruler');
		
		return $super();
	}
});

DAxis.defaultData = {
	tickItems: [],
	tickGenerators: []
};

DAxis.defaultTickGenerator = {
	algorithm: 'quantity',
	idealTicks: 8,
	tickTemplates: [
		{bar: true, tick:  true, label:  true, anchor: 'default'},
		{bar: true, tick: false, label: false, anchor: 'default'},
	]
};


/** Todo sinchronyze with the Scale **/

var DAxesGroup = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'axesGroup';
		this.className = 'DAxesGroup';
	},
	
	processData: function()
	{		
		this.createAxes();
	},
	
	createAxes: function()
	{
		this.xAxis = new DAxis(this, 'contains', this.data.xAxis, 'xAxis');		
		this.yAxis = new DAxis(this, 'contains', this.data.yAxis, 'yAxis');
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.xAxis  == undefined) this.data.xAxis = JSONcopy(DAxesGroup.defaultData.xAxis);
		if (this.data.yAxis  == undefined) this.data.yAxis = JSONcopy(DAxesGroup.defaultData.yAxis);
		
		if (this.data.xAxis.orientation == undefined) this.data.xAxis.orientation = 'x';
		if (this.data.yAxis.orientation == undefined) this.data.yAxis.orientation = 'y';
	},
	
	updateDrawing: function($super)
	{
		this.invokeRelatedNodes(this.myContext + '.contains-DAxis:*', 'draw');
		
		return $super();
	},
	
	refreshTicks: function()
	{
		this.invokeRelatedNodes('.contains-DAxis:*','refreshTicks');
	},
	
	getCanvas: function()
	{
		if (this.canvas == undefined)
			return this.canvas = this.getNode(this.myContext + '.^draws-DCanvas');
		else
			return this.canvas;
	}
});

DAxesGroup.defaultData = {
	xAxis: {
		orientation: 'x',
		rules: {bottom: {}},
		tickGenerators: []
	},
	yAxis: {
		orientation: 'y',
		rules: {left: {}},
		tickGenerators: []
	}
}


var DLegendEntry = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'legendEntry';
		this.className = 'DLegendEntry';
	},
	
	processData: function()
	{
	},
	
	applyDefaultData: function()
	{	
		if (this.data == undefined) this.data = {};
	
		if (this.data.caption          == undefined) this.data.caption = DLegendEntry.caption;
		if (this.data.attributes       == undefined) this.data.attributes = {};;
		if (this.data.attributes.color == undefined) this.data.attributes.color = DLegendEntry.defaultData.attributes.color;
		if (this.data.position         == undefined) this.data.position = DLegendEntry.defaultData.position;
	},
	
	firstDraw: function($super)
	{	
		this.refLabelElement0     = this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legend-ref-0-label');
		this.refLabelElement1     = this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legend-ref-1-label');
		this.refLineElement0      = this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legend-ref-0-line');
		this.refLineElement1      = this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legend-ref-1-line');
		this.refSeparatorElement0 = this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legend-ref-0-separator');
		this.refSeparatorElement1 = this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legend-ref-1-separator');
		this.refBgElement0        = this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legend-ref-0-bg');
		this.refBgElement1        = this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legend-ref-1-bg');
		
		this.verticalOffset  = this.refSeparatorElement1.getAttributeNS(null, 'y1') - this.refSeparatorElement0.getAttributeNS(null, 'y1');
		this.lineOffset      = this.refLineElement0.getAttributeNS(null, 'y1') - this.refSeparatorElement0.getAttributeNS(null, 'y1');
		this.lineWidth       = Math.abs(this.refLineElement0.getAttributeNS(null, 'x1') - this.refLineElement0.getAttributeNS(null, 'x2'));
		this.labelYOffset    = this.refLabelElement0.getAttributeNS(null, 'y') - this.refSeparatorElement0.getAttributeNS(null, 'y1');
		this.labelXOffset    = this.refLabelElement0.getAttributeNS(null, 'x') - this.refSeparatorElement0.getAttributeNS(null, 'x1');
		
		this.separatorElement    = this.refSeparatorElement0.cloneNode(true);
		this.separatorElement.id = 'legend-entry-separator-' + this.data.position;
		this.lineElement         = this.refLineElement0.cloneNode(true);
		this.lineElement.id      = 'legend-entry-line-' + this.data.position;
		this.labelElement        = this.refLabelElement0.cloneNode(false);
		this.labelElement.id     = 'legend-entry-label-' + this.data.position;
		this.bgElement           = this.refBgElement0.cloneNode(false);
		this.bgElement.id        = 'legend-entry-bg-' + this.data.position;
		
		
		this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legends').appendChild(this.bgElement);
		this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legends').appendChild(this.separatorElement);
		this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legends').appendChild(this.lineElement);
		this.getNode('.^contains-DLegend.^contains-DChart').doc.getElementById('legends').appendChild(this.labelElement);
		
		this.separatorElement.addEventListener('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
		this.separatorElement.addEventListener('mouseout',  (function(ev) { this.fire('endhighlight'  , ev)}).bind(this), false);
		this.lineElement.addEventListener     ('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
		this.lineElement.addEventListener     ('mouseout',  (function(ev) { this.fire('endhighlight'  , ev)}).bind(this), false);
		this.labelElement.addEventListener    ('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
		this.labelElement.addEventListener    ('mouseout',  (function(ev) { this.fire('endhighlight'  , ev)}).bind(this), false);
		this.bgElement.addEventListener       ('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
		this.bgElement.addEventListener       ('mouseout',  (function(ev) { this.fire('endhighlight'  , ev)}).bind(this), false);
		this.dotElement.addEventListener      ('mouseover', (function(ev) { this.fire('starthighlight', ev)}).bind(this), false);
		this.dotElement.addEventListener      ('mouseout', (function(ev) { this.fire('endhighlight', ev)}).bind(this), false);
				
		
		
		$super();
	},
	
	setHighlight: function(status)
	{
		if (status)
		{
			this.bgElement.setAttributeNS(null,"class", this.bgElement.getAttributeNS(null,"class") + " highlight");
		}
		else
		{
			this.bgElement.setAttributeNS(null,"class", this.bgElement.getAttributeNS(null,"class").replace(" highlight",""));
		}
		
	},
	
	updateDrawing: function($super)
	{
		var vOffset = (this.data.position+1) * this.verticalOffset;
		
		this.separatorElement.setAttributeNS(null, 'y1', vOffset + this.parentNode.data.y);
		this.separatorElement.setAttributeNS(null, 'y2', vOffset + this.parentNode.data.y);
		this.separatorElement.setAttributeNS(null, 'x1', this.parentNode.data.x);
		this.separatorElement.setAttributeNS(null, 'x2', this.parentNode.data.x + this.parentNode.data.width);
		
		this.lineElement.setAttributeNS(null, 'y1', this.lineOffset + vOffset + this.parentNode.data.y);
		this.lineElement.setAttributeNS(null, 'y2', this.lineOffset + vOffset + this.parentNode.data.y);
		this.lineElement.setAttributeNS(null, 'x1', this.parentNode.data.x);
		this.lineElement.setAttributeNS(null, 'x2', this.parentNode.data.x + this.lineWidth);
		this.lineElement.setAttributeNS(null, 'stroke', this.data.attributes.color);
		
		this.labelElement.setAttributeNS(null, 'x', this.labelXOffset + this.parentNode.data.x);
		this.labelElement.setAttributeNS(null, 'y', this.labelYOffset + vOffset + this.parentNode.data.y);		
		if (this.labelElement.lastChild)
			this.labelElement.removeChild(this.labelElement.lastChild);		
		this.labelElement.appendChild(this.getNode('.^contains-DLegend.^contains-DChart').doc.createTextNode(this.data.caption));
		
		this.bgElement.setAttributeNS(null, 'x', this.parentNode.data.x);
		this.bgElement.setAttributeNS(null, 'y', vOffset - this.verticalOffset + this.parentNode.data.y);
		this.bgElement.setAttributeNS(null, 'width', this.parentNode.data.width);
		this.bgElement.setAttributeNS(null, 'height', this.verticalOffset);
		
		
		$super();
	}
});

DLegendEntry.defaultData = {
	caption: false,
	attributes: {
		color: '#000',
	},
	position: 0
};


var DLegend = Class.create(DChartNode, {
	setClassNameAndName: function()
	{
		if (this.name == undefined || this.name == null)
			this.name = 'legend';
		this.className = 'DLegend';
	},
	
	processData: function()
	{
		this.lastPosition = 0;
	},
	
	applyDefaultData: function()
	{	
		if (this.data == undefined) this.data = {};
	
		if (this.data.x     == undefined) this.data.x     = DLegend.defaultData.x;
		if (this.data.y     == undefined) this.data.y     = DLegend.defaultData.y;
		if (this.data.width == undefined) this.data.width = DLegend.defaultData.width;
	},
	
	addEntry: function (serie, entryData)
	{
		entryData.position = this.lastPosition; 
		this.lastPosition++;
		
		this.lastEntry = new DLegendEntry(this, 'contains', entryData, entryData.position);
		
		serie.addRelationToNode(this.lastEntry, 'adds');
	},
	
	updateDrawing: function ($super)
	{
		this.invokeRelatedNodes('.contains-DLegendEntry:*','draw');
		
		$super();
	}
});

DLegend.defaultData = {
	x: 400,
	y: 50,
	width: 150
};


var DChart = Class.create(DChartNode, {
	
	setClassNameAndName: function()
	{
		this.name = this.objId;
		this.className = 'DChart';
	},
	
	initialize: function ($super, templateUrl, data, name)
	{
		$super(undefined, undefined, data, name);
		
		this.myContext = this.className + ':' + this.objId; //The charts are the only ones that use the ids instead of the names
		
		this.createChilds();
		
		this.svgContainerElement = new Element('object',{
			data: templateUrl,
			type: 'image/svg+xml'
		});
		
		this.svgContainerElement.observe ('load', this.onSVGLoad.bind(this));
	},
	
	getContainerElement: function ()
	{
		return this.svgContainerElement;
	},
	
	onSVGLoad: function()
	{
		this.doc = this.svgContainerElement.contentDocument;
		
		/*POG - not the right place*/
		
		
				
		if (Prototype.Browser.IE)
		{
			this.doc.documentElement.setAttributeNS(null, 'width', this.data.container.width + 'px');
			this.doc.documentElement.setAttributeNS(null, 'height', this.data.container.height + 'px');
			
			this.doc.documentElement.setAttributeNS(null, 'viewBox', '0 0 ' + this.data.container.width + ' ' + this.data.container.height);
			this.doc.documentElement.setAttributeNS(null, 'enable-background', 'new 0 0 ' + this.data.container.width + ' ' +this.data.container.height);
		}
		else
		{
			this.doc.documentElement.setAttribute('width', this.data.container.width + 'px');
			this.doc.documentElement.setAttribute('height', this.data.container.height + 'px');
			
			this.svgContainerElement.setAttribute('style', 'width: ' + this.data.container.width +'px; height: ' + this.data.container.height +'px;');
			
			this.doc.documentElement.setAttribute('viewBox', '0 0 ' + this.data.container.width + ' ' + this.data.container.height);
			this.doc.documentElement.setAttribute('enable-background', 'new 0 0 ' + this.data.container.width + ' ' +this.data.container.height);
		}
		
		this.invokeRelatedNodes('.DCanvas:*', 'setBaseSVGDocument', this.doc);
		
		this.draw();
	},
	
	createChilds: function()
	{
		var seriesGroup;
		
		if (this.data.legends != undefined)
			for (legendName in this.data.legends)
				legend = new DLegend(this, 'contains', this.data.legends[legendName], legendName);
		
		for (scaleName in this.data.scales)
			scale = new DScale(this, 'contains', this.data.scales[scaleName], scaleName);
		
		for (axesGroupName in this.data.axesGroups)
			axesGroup = new DAxesGroup(this, 'contains', this.data.axesGroups[axesGroupName], axesGroupName);
		
		for (canvasName in this.data.canvases)
			canvas = new DCanvas(this, 'contains', this.data.canvases[canvasName], canvasName);
		
		for (seriesGroupName in this.data.seriesGroups)
			seriesGroup = new DSeriesGroup(this, 'contains', this.data.seriesGroups[seriesGroupName], seriesGroupName);
	},
	
	processData: function()
	{
	},
	
	applyDefaultData: function()
	{
		if (!this.data) this.data = {};
		
		if (this.data.seriesGroups == undefined) this.data.x = JSONcopy(DChart.defaultData.seriesGroups);
		if (this.data.scales       == undefined) this.data.x = JSONcopy(DChart.defaultData.scales);
		if (this.data.axesGroups   == undefined) this.data.x = JSONcopy(DChart.defaultData.axesGroups);
		if (this.data.canvasGroups == undefined) this.data.x = JSONcopy(DChart.defaultData.canvasGroups);
	},
	
	updateDrawing: function($super)
	{
		this.invokeRelatedNodes('.contains-DSeriesGroup:*','draw');
		this.invokeRelatedNodes('.contains-DCanvas:*','draw');
		this.invokeRelatedNodes('.contains-DLegend:*','draw');
		$super();
	},
});

DChart.defaultData = {
	seriesGroups: {},
	scales: {},	
	axesGroups: {},
	canvasGroups: {}
};
