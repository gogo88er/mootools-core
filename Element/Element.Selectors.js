/*
Script: Element.Selectors.js
	Css Query related functions and <Element> extensions

License:
	MIT-style license.
*/

/* Section: Utility Functions */

/*
Function: $E
	Selects a single (i.e. the first found) Element based on the selector passed in and an optional filter element.
	Returns as <Element>.

Arguments:
	selector - string; the css selector to match
	filter - optional; a DOM element to limit the scope of the selector match; defaults to document.

Example:
	>$E('a', 'myElement') //find the first anchor tag inside the DOM element with id 'myElement'

Returns:
	a DOM element - the first element that matches the selector
*/

function $E(selector, filter){
	return ($(filter) || document).getElement(selector);
};

/*
Function: $ES
	Returns a collection of Elements that match the selector passed in limited to the scope of the optional filter.
	See Also: <Element.getElements> for an alternate syntax.
	Returns as <Elements>.

Returns:
	an array of dom elements that match the selector within the filter

Arguments:
	selector - string; css selector to match
	filter - optional; a DOM element to limit the scope of the selector match; defaults to document.

Examples:
	>$ES("a") //gets all the anchor tags; synonymous with $$("a")
	>$ES('a','myElement') //get all the anchor tags within $('myElement')
*/

function $ES(selector, filter){
	return ($(filter) || document).getElementsBySelector(selector);
};

var DOM = {
	
	'regExp': /^(\w*|\*)(?:#([\w-]+))?(?:\.([\w-]+))?(?:\[(.*)\])?(?::(.*))?$/,
	
	'aRegExp': /^(\w+)(?:([!*^$\~]?=)["']?([^"'\]]*)["']?)?$/,
	
	'nRegExp': /^([+]?\d*)?([nodev]+)?([+]?\d*)?$/,
	
	'sRegExp': /\s*([+>~\s])[a-zA-Z#.*\s]/g,
	
	'pRegExp': /^([\w-]+)(?:\((.*)\))?$/
	
};

DOM.parsePseudo = function(pseudo){
	pseudo = pseudo.match(DOM.pRegExp);
	if (!pseudo) throw new Error('bad pseudo selector');
	var pparam = false;
	var name = pseudo[1].split('-')[0];
	switch(name){
		case 'nth':
			pparam = (pseudo[2]) ? pseudo[2].match(DOM.nRegExp) : [null, 1, 'n', 0];
			if (!pparam) throw new Error('bad nth pseudo selector parameters');
			var int1 = parseInt(pparam[1]);
			pparam[1] = ($chk(int1)) ? int1 : 1;
			pparam[2] = pparam[2] || false;
			pparam[3] = parseInt(pparam[3]) || 0;
			switch(pparam[2]){
				case 'n': pparam = [pparam[1], true, pparam[3]]; break;
				case 'odd': pparam = [2, true, 0]; break;
				case 'even': pparam = [2, true, 1]; break;
				case false: pparam = [pparam[1], false];
			}
		break;
		case 'contains': pparam = pseudo[2]; break;
		case 'odd':
			name = 'nth';
			pparam = [2, true, 0];
		break;
		case 'even':
			name = 'nth';
			pparam = [2, true, 1];
		break;
	}
	return {'name': name, 'param': pparam};
};

DOM.XPath = {

	getParam: function(items, separator, context, tag, id, className, attribute, pseudo){
		var temp = context.namespaceURI ? 'xhtml:' : '';
		switch(separator){
			case '~': case '+': temp += '/following-sibling::'; break;
			case '>': temp += '/'; break;
			case ' ': temp += '//';
		}
		temp += tag;
		if (separator == '+') temp += '[1]';
		if (pseudo){
			pseudo = DOM.parsePseudo(pseudo);
			switch(pseudo.name){
				case 'nth':
					var nth = (pseudo.param[1]) ? 'mod ' + pseudo.param[0] + ' = ' + pseudo.param[2] : '= ' + pseudo.param[0];
					temp += '[count(preceding-sibling::*) ' + nth + ']';
					break;
				case 'first': temp += '[1]'; break;
				case 'last': temp += '[last()]'; break;
				case 'empty': temp += '[not(node())]'; break;
				case 'only': temp += '[not(preceding-sibling::* or following-sibling::*)]'; break;
				case 'contains': temp += '[contains(text(), "' + pseudo.param + '")]'; break;
				case 'enabled': temp += '[not(@disabled)]'; break;
				default:
					temp += '[@' + pseudo.name;
					temp += (pseudo.param) ? '="' + pseudo.param + '"]' : ']';
			}
		}
		if (id) temp += '[@id="' + id + '"]';
		if (className) temp += '[contains(concat(" ", @class, " "), " ' + className + ' ")]';
		if (attribute){
			attribute = attribute.match(DOM.aRegExp);
			if (!attribute) throw new Error('bad attribute selector');
			if (attribute[2] && attribute[3]){
				switch(attribute[2]){
					case '=': temp += '[@' + attribute[1] + '="' + attribute[3] + '"]'; break;
					case '*=': temp += '[contains(@' + attribute[1] + ', "' + attribute[3] + '")]'; break;
					case '^=': temp += '[starts-with(@' + attribute[1] + ', "' + attribute[3] + '")]'; break;
					case '$=': temp += '[substring(@' + attribute[1] + ', string-length(@' + attribute[1] + ') - ' + attribute[3].length + ' + 1) = "' + attribute[3] + '"]'; break;
					case '!=': temp += '[@' + attribute[1] + '!="' + attribute[3] + '"]'; break;
					case '~=': temp += '[contains(concat(" ", @' + attribute[1] + ', " "), " ' + attribute[3] + ' ")]';
				}
			} else {
				temp += '[@' + attribute[1] + ']';
			}
		}
		items.push(temp);
		return items;
	},
	
	getItems: function(items, context, nocash){
		var elements = [];
		var xpath = document.evaluate('.//' + items.join(''), context, DOM.XPath.resolver, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
		for (var i = 0, j = xpath.snapshotLength; i < j; i++) elements.push(xpath.snapshotItem(i));
		return (nocash) ? elements : new Elements(elements.map($));
	},
	
	resolver: function(prefix){
		return (prefix == 'xhtml') ? 'http://www.w3.org/1999/xhtml' : false;
	}
	
};

DOM.Filter = {

	getParam: function(items, separator, context, tag, id, className, attribute, pseudo){
		if (separator){
			switch(separator){
				case ' ': items = DOM.Filter.getNestedByTag(items, tag); break;
				case '>': items = DOM.Filter.getChildrenByTag(items, tag); break;
				case '+': items = DOM.Filter.getFollowingByTag(items, tag); break;
				case '~': items = DOM.Filter.getFollowingByTag(items, tag, true);
			}
			if (id) items = Elements.filterById(items, id, true);
		} else {
			if (id){
				var el = context.getElementById(id);
				if (!el || ((tag != '*') && (el.tagName.toLowerCase() != tag))) return false;
				items = [el];
			} else {
				items = $A(context.getElementsByTagName(tag));
			}
		}
		if (className) items = Elements.filterByClass(items, className, true);
		if (attribute){
			attribute = attribute.match(DOM.aRegExp);
			if (!attribute) throw new Error('bad attribute selector');
			items = Elements.filterByAttribute(items, attribute[1], attribute[2], attribute[3], true);
		}
		if (pseudo){
			pseudo = DOM.parsePseudo(pseudo);
			items = Elements.filterByPseudo(items, pseudo.name, pseudo.param, true);
		}
		return items;
	},

	getItems: function(items, context, nocash){
		return (nocash) ? items : $$.unique(items);
	},
	
	hasTag: function(el, tag){
		return (el.nodeName && el.nodeType == 1 && (tag == '*' || el.tagName.toLowerCase() == tag));
	},
	
	getFollowingByTag: function(context, tag, all){
		var found = [];
		for (var i = 0, j = context.length; i < j; i++){
			var next = context[i].nextSibling;
			while (next){
				if (DOM.Filter.hasTag(next, tag)){
					found.push(next);
					if (!all) break;
				}
				next = next.nextSibling;
			}
		}
		return found;
	},
	
	getChildrenByTag: function(context, tag){
		var found = [];
		for (var i = 0, j = context.length; i < j; i++){
			var children = context[i].childNodes;
			for (var k = 0, l = children.length; k < l; k++){
				if (DOM.Filter.hasTag(children[k], tag)) found.push(children[k]);
			}
		}
		return found;
	},
	
	getNestedByTag: function(context, tag){
		var found = [];
		for (var i = 0, j = context.length; i < j; i++) found.extend(context[i].getElementsByTagName(tag));
		return found;
	}
	
};

DOM.Method = (Client.features.xpath) ? DOM.XPath : DOM.Filter;

/*
Class: Element
	Custom class to allow all of its methods to be used with any DOM element via the dollar function <$>.
*/

Element.$domMethods = {

	/*
	Property: getElements
		Gets all the elements within an element that match the given (single) selector.
		Returns as <Elements>.

	Arguments:
		selector - string; the css selector to match

	Examples:
		>$('myElement').getElements('a'); // get all anchors within myElement
		>$('myElement').getElements('input[name=dialog]') //get all input tags with name 'dialog'
		>$('myElement').getElements('input[name$=log]') //get all input tags with names ending with 'log'

	Notes:
		Supports these operators in attribute selectors:

		- = : is equal to
		- ^= : starts-with
		- $= : ends-with
		- != : is not equal to

		Xpath is used automatically for compliant browsers.
	*/

	getElements: function(selector, nocash){
		var items = [];
		var separators = [];
		selector = selector.trim().replace(DOM.sRegExp, function(match){
			if (match.charAt(2)) match = match.trim();
			separators.push(match.charAt(0));
			return '%' + match.charAt(1);
		}).split('%');
		for (var i = 0, j = selector.length; i < j; i++){
			var param = selector[i].match(DOM.regExp);
			if (!param) throw new Error('bad selector');
			var temp = DOM.Method.getParam(items, separators[i - 1] || false, this, param[1] || '*', param[2], param[3], param[4], param[5]);
			if (!temp) break;
			items = temp;
		}
		return DOM.Method.getItems(items, this, nocash);
	},

	/*
	Property: getElement
		Same as <Element.getElements>, but returns only the first. Alternate syntax for <$E>, where filter is the Element.
		Returns as <Element>.

	Arguments:
		selector - string; css selector
	*/

	getElement: function(selector){
		return $(this.getElements(selector, true)[0] || false);
	},

	/*
	Property: getElementsBySelector
		Same as <Element.getElements>, but allows for comma separated selectors, as in css. Alternate syntax for <$$>, where filter is the Element.
		Returns as <Elements>.

	Arguments:
		selector - string; css selector
	*/

	getElementsBySelector: function(selector, nocash){
		var elements = [];
		selector = selector.split(',');
		for (var i = 0, j = selector.length; i < j; i++) elements = elements.concat(this.getElements(selector[i], true));
		return (nocash) ? elements : $$.unique(elements);
	}

};

Element.extend({

	/*
	Property: getElementById
		Targets an element with the specified id found inside the Element. Does not overwrite document.getElementById.

	Arguments:
		id - string; the id of the element to find.
	*/

	getElementById: function(id){
		var el = document.getElementById(id);
		if (!el) return null;
		for (var parent = el.parentNode; parent != this; parent = parent.parentNode){
			if (!parent) return null;
		}
		return el;
	}

});

document.extend(Element.$domMethods);
Element.extend(Element.$domMethods);