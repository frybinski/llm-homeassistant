// node_modules/@lit/reactive-element/css-tag.js
var e = globalThis, t = e.ShadowRoot && (e.ShadyCSS === void 0 || e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, n = Symbol(), r = /* @__PURE__ */ new WeakMap(), i = class {
	constructor(e, t, r) {
		if (this._$cssResult$ = !0, r !== n) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, n = this.t;
		if (t && e === void 0) {
			let t = n !== void 0 && n.length === 1;
			t && (e = r.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), t && r.set(n, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, a = (e) => new i(typeof e == "string" ? e : e + "", void 0, n), o = (e, ...t) => new i(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, n), s = (n, r) => {
	if (t) n.adoptedStyleSheets = r.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let t of r) {
		let r = document.createElement("style"), i = e.litNonce;
		i !== void 0 && r.setAttribute("nonce", i), r.textContent = t.cssText, n.appendChild(r);
	}
}, c = t ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return a(t);
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, g = h.trustedTypes, ee = g ? g.emptyScript : "", _ = h.reactiveElementPolyfillSupport, v = (e, t) => e, y = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? ee : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, b = (e, t) => !l(e, t), x = {
	attribute: !0,
	type: String,
	converter: y,
	reflect: !1,
	useDefault: !1,
	hasChanged: b
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var S = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = x) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && u(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = d(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? x;
	}
	static _$Ei() {
		if (this.hasOwnProperty(v("elementProperties"))) return;
		let e = m(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(v("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(v("properties"))) {
			let e = this.properties, t = [...f(e), ...p(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(1 / 0).reverse());
			for (let e of n) t.unshift(c(e));
		} else e !== void 0 && t.push(c(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return s(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? y : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? y : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? b)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
S.elementStyles = [], S.shadowRootOptions = { mode: "open" }, S[v("elementProperties")] = /* @__PURE__ */ new Map(), S[v("finalized")] = /* @__PURE__ */ new Map(), _?.({ ReactiveElement: S }), (h.reactiveElementVersions ??= []).push("2.1.2");
// node_modules/lit-html/lit-html.js
var C = globalThis, w = (e) => e, T = C.trustedTypes, E = T ? T.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, D = "$lit$", O = `lit$${Math.random().toFixed(9).slice(2)}$`, te = "?" + O, ne = `<${te}>`, k = document, A = () => k.createComment(""), j = (e) => e === null || typeof e != "object" && typeof e != "function", re = Array.isArray, ie = (e) => re(e) || typeof e?.[Symbol.iterator] == "function", ae = "[ 	\n\f\r]", M = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, oe = /-->/g, se = />/g, N = RegExp(`>|${ae}(?:([^\\s"'>=/]+)(${ae}*=${ae}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), ce = /'/g, le = /"/g, ue = /^(?:script|style|textarea|title)$/i, de = (e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}), P = de(1), F = de(2), I = Symbol.for("lit-noChange"), L = Symbol.for("lit-nothing"), fe = /* @__PURE__ */ new WeakMap(), R = k.createTreeWalker(k, 129);
function pe(e, t) {
	if (!re(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return E === void 0 ? t : E.createHTML(t);
}
var me = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = M;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === M ? c[1] === "!--" ? o = oe : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = N) : (ue.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = N) : o = se : o === N ? c[0] === ">" ? (o = i ?? M, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? N : c[3] === "\"" ? le : ce) : o === le || o === ce ? o = N : o === oe || o === se ? o = M : (o = N, i = void 0);
		let d = o === N && e[t + 1].startsWith("/>") ? " " : "";
		a += o === M ? n + ne : l >= 0 ? (r.push(s), n.slice(0, l) + D + n.slice(l) + O + d) : n + O + (l === -2 ? t : d);
	}
	return [pe(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, he = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = me(t, n);
		if (this.el = e.createElement(l, r), R.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = R.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(D)) {
					let t = u[o++], n = i.getAttribute(e).split(O), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? ye : r[1] === "?" ? be : r[1] === "@" ? xe : ve
					}), i.removeAttribute(e);
				} else e.startsWith(O) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (ue.test(i.tagName)) {
					let e = i.textContent.split(O), t = e.length - 1;
					if (t > 0) {
						i.textContent = T ? T.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], A()), R.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], A());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === te) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(O, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += O.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = k.createElement("template");
		return n.innerHTML = e, n;
	}
};
function z(e, t, n = e, r) {
	if (t === I) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = j(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = z(e, i._$AS(e, t.values), i, r)), t;
}
var ge = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? k).importNode(t, !0);
		R.currentNode = r;
		let i = R.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new _e(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Se(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = R.nextNode(), a++);
		}
		return R.currentNode = k, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, _e = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = L, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = z(this, e, t), j(e) ? e === L || e == null || e === "" ? (this._$AH !== L && this._$AR(), this._$AH = L) : e !== this._$AH && e !== I && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ie(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== L && j(this._$AH) ? this._$AA.nextSibling.data = e : this.T(k.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = he.createElement(pe(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new ge(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = fe.get(e.strings);
		return t === void 0 && fe.set(e.strings, t = new he(e)), t;
	}
	k(t) {
		re(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(A()), this.O(A()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = w(e).nextSibling;
			w(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, ve = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = L, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = L;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = z(this, e, t, 0), a = !j(e) || e !== this._$AH && e !== I, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = z(this, r[n + o], t, o), s === I && (s = this._$AH[o]), a ||= !j(s) || s !== this._$AH[o], s === L ? e = L : e !== L && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === L ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, ye = class extends ve {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === L ? void 0 : e;
	}
}, be = class extends ve {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== L);
	}
}, xe = class extends ve {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = z(this, e, t, 0) ?? L) === I) return;
		let n = this._$AH, r = e === L && n !== L || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== L && (n === L || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Se = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		z(this, e);
	}
}, Ce = C.litHtmlPolyfillSupport;
Ce?.(he, _e), (C.litHtmlVersions ??= []).push("3.3.3");
var we = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new _e(t.insertBefore(A(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Te = globalThis, B = class extends S {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = we(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return I;
	}
};
B._$litElement$ = !0, B.finalized = !0, Te.litElementHydrateSupport?.({ LitElement: B });
var Ee = Te.litElementPolyfillSupport;
Ee?.({ LitElement: B }), (Te.litElementVersions ??= []).push("4.2.2");
// src/api.ts
var De = class extends Error {
	constructor(e, t) {
		super(t), this.code = e;
	}
};
function V(e) {
	if (e instanceof De) return e;
	if (e && typeof e == "object") {
		let { code: t, message: n } = e;
		return new De(typeof t == "string" || typeof t == "number" ? String(t) : "unknown", typeof n == "string" ? n : JSON.stringify(e));
	}
	return new De("unknown", String(e));
}
async function Oe(e, t) {
	try {
		return await e.callWS(t);
	} catch (e) {
		throw V(e);
	}
}
var ke = (e) => Oe(e, { type: "ai_drafts/changesets/list" }), Ae = (e) => Oe(e, { type: "ai_drafts/models" }), je = (e, t, n) => Oe(e, {
	type: "ai_drafts/draft",
	request: t,
	...n === void 0 ? {} : { model: n }
});
function Me(e, t, n, r) {
	let i = {
		type: `ai_drafts/changesets/${t}`,
		change_set_id: n
	};
	return t !== "revert" && (i.decided_in = r.decidedIn, i.views_opened = r.viewsOpened), Oe(e, i);
}
// src/demo/automations.json
var Ne = [
	{
		id: "nachtmodus_an",
		alias: "Nachtmodus um 23 Uhr",
		mode: "single",
		triggers: [{
			trigger: "time",
			at: "23:00:00"
		}],
		conditions: [],
		actions: [{
			action: "input_boolean.turn_on",
			target: { entity_id: "input_boolean.nachtmodus" }
		}]
	},
	{
		id: "nachtruhe_flur",
		alias: "Nachtruhe im Flur",
		mode: "single",
		triggers: [{
			trigger: "state",
			entity_id: "light.flurlicht",
			to: "on"
		}],
		conditions: [{
			condition: "state",
			entity_id: "input_boolean.nachtmodus",
			state: "on"
		}],
		actions: [{
			action: "light.turn_off",
			target: { entity_id: "light.flurlicht" }
		}]
	},
	{
		id: "kuechenlicht_bewegung",
		alias: "Küchenlicht bei Bewegung",
		mode: "restart",
		triggers: [{
			trigger: "state",
			entity_id: "binary_sensor.kueche_bewegungsmelder",
			to: "on"
		}],
		conditions: [],
		actions: [
			{
				action: "light.turn_on",
				target: { entity_id: "light.kueche_arbeitslicht" }
			},
			{ delay: "00:05:00" },
			{
				action: "light.turn_off",
				target: { entity_id: "light.kueche_arbeitslicht" }
			}
		]
	},
	{
		id: "kinoabend",
		alias: "Kinoabend",
		mode: "single",
		triggers: [{
			trigger: "state",
			entity_id: "media_player.wohnzimmer_tv",
			to: "playing"
		}],
		conditions: [{
			condition: "state",
			entity_id: "sun.sun",
			state: "below_horizon"
		}],
		actions: [{
			action: "light.turn_off",
			target: { entity_id: "light.wohnzimmer_deckenlicht" }
		}, {
			action: "light.turn_on",
			target: { entity_id: "light.wohnzimmer_stehlampe" }
		}]
	}
], Pe = [
	{
		id: "cs_demo_flurlicht",
		request: "Schalte das Flurlicht bei Bewegung nach Sonnenuntergang für 3 Minuten ein",
		status: "checked",
		operations: [{
			kind: "automation",
			op: "create",
			target_id: null,
			before: null,
			after: {
				id: "flurlicht_bewegung",
				alias: "Flurlicht bei Bewegung",
				mode: "restart",
				triggers: [{
					trigger: "state",
					entity_id: "binary_sensor.flur_bewegungsmelder",
					to: "on"
				}],
				conditions: [{
					condition: "state",
					entity_id: "sun.sun",
					state: "below_horizon"
				}],
				actions: [
					{
						action: "light.turn_on",
						target: { entity_id: "light.flurlicht" }
					},
					{ delay: "00:03:00" },
					{
						action: "light.turn_off",
						target: { entity_id: "light.flurlicht" }
					}
				]
			}
		}],
		findings: [{
			severity: "warning",
			check: "conflicts.opposing_actions",
			message: "Nach 23:00 Uhr schaltet „Nachtruhe im Flur“ das Flurlicht sofort wieder aus, sobald dieser Vorschlag es einschaltet. Das Licht brennt dann nicht 3 Minuten.",
			path: "actions[0]",
			net_refs: [
				"t:flurlicht_bewegung:action:0",
				"p:light.flurlicht:on",
				"t:nachtruhe_flur:trigger:0",
				"t:nachtruhe_flur:action:0",
				"p:input_boolean.nachtmodus:on"
			]
		}],
		model: "ai_task.beispielmodell",
		rounds: 0,
		created: "2026-11-18T21:30:00+00:00",
		decided: null
	},
	{
		id: "cs_demo_kueche",
		request: "Schalte das Küchenlicht bei Bewegung ein und nach 5 Minuten wieder aus",
		status: "applied",
		operations: [{
			kind: "automation",
			op: "create",
			target_id: null,
			before: null,
			after: {
				id: "kuechenlicht_bewegung",
				alias: "Küchenlicht bei Bewegung",
				mode: "restart",
				triggers: [{
					trigger: "state",
					entity_id: "binary_sensor.kueche_bewegungsmelder",
					to: "on"
				}],
				conditions: [],
				actions: [
					{
						action: "light.turn_on",
						target: { entity_id: "light.kueche_arbeitslicht" }
					},
					{ delay: "00:05:00" },
					{
						action: "light.turn_off",
						target: { entity_id: "light.kueche_arbeitslicht" }
					}
				]
			}
		}],
		findings: [],
		model: "ai_task.beispielmodell",
		rounds: 0,
		created: "2026-11-12T18:02:11+00:00",
		decided: "2026-11-12T18:03:40+00:00"
	},
	{
		id: "cs_demo_wohnzimmer",
		request: "Dimme im Wohnzimmer alle Lichter, wenn der Fernseher läuft",
		status: "discarded",
		operations: [{
			kind: "automation",
			op: "create",
			target_id: null,
			before: null,
			after: {
				id: "wohnzimmer_fernsehlicht",
				alias: "Wohnzimmer dimmen beim Fernsehen",
				mode: "single",
				triggers: [{
					trigger: "state",
					entity_id: "media_player.wohnzimmer_tv",
					to: "playing"
				}],
				conditions: [],
				actions: [{
					action: "light.turn_on",
					target: { entity_id: "light.wohnzimmer_deckenlicht" },
					data: { brightness_pct: 20 }
				}]
			}
		}],
		findings: [{
			severity: "info",
			check: "validity.plausibility",
			message: "Die Stehlampe im Wohnzimmer wird nicht gedimmt, obwohl „alle Lichter“ verlangt war.",
			path: "actions",
			net_refs: []
		}],
		model: "ai_task.beispielmodell",
		rounds: 1,
		created: "2026-11-14T19:45:02+00:00",
		decided: "2026-11-14T19:46:30+00:00"
	},
	{
		id: "cs_demo_bad",
		request: "Schalte das Licht im Bad aus, wenn niemand mehr da ist",
		status: "failed",
		operations: [{
			kind: "automation",
			op: "create",
			target_id: null,
			before: null,
			after: {
				id: "bad_licht_aus",
				alias: "Badlicht aus bei Leere",
				mode: "single",
				triggers: [{
					trigger: "state",
					entity_id: "binary_sensor.bad_praesenz",
					to: "off",
					for: "00:05:00"
				}],
				conditions: [],
				actions: [{
					action: "light.turn_off",
					target: { entity_id: "light.bad_deckenlicht" }
				}]
			}
		}],
		findings: [
			{
				severity: "error",
				check: "validity.entity_exists",
				message: "Die Entität light.bad_deckenlicht existiert nicht.",
				path: "actions[0].target.entity_id",
				net_refs: []
			},
			{
				severity: "error",
				check: "validity.entity_exists",
				message: "Die Entität binary_sensor.bad_praesenz existiert nicht.",
				path: "triggers[0].entity_id",
				net_refs: []
			},
			{
				severity: "error",
				check: "pipeline",
				message: "Der Fehler konnte in 3 Reparaturrunden nicht behoben werden.",
				path: null,
				net_refs: []
			}
		],
		model: "ai_task.beispielmodell",
		rounds: 3,
		created: "2026-11-16T07:12:44+00:00",
		decided: null
	}
], Fe = {
	areas: [
		{
			id: "flur",
			name: "Flur",
			icon: "mdi:door"
		},
		{
			id: "wohnzimmer",
			name: "Wohnzimmer",
			icon: "mdi:sofa"
		},
		{
			id: "kueche",
			name: "Küche",
			icon: "mdi:silverware-fork-knife"
		}
	],
	entities: [
		{
			entity_id: "binary_sensor.flur_bewegungsmelder",
			name: "Bewegungsmelder",
			icon: "mdi:motion-sensor",
			state: "off",
			area_id: "flur"
		},
		{
			entity_id: "light.flurlicht",
			name: "Flurlicht",
			icon: "mdi:ceiling-light",
			state: "off",
			area_id: "flur"
		},
		{
			entity_id: "media_player.wohnzimmer_tv",
			name: "Fernseher",
			icon: "mdi:television",
			state: "off",
			area_id: "wohnzimmer"
		},
		{
			entity_id: "light.wohnzimmer_deckenlicht",
			name: "Deckenlicht",
			icon: "mdi:ceiling-light",
			state: "on",
			area_id: "wohnzimmer"
		},
		{
			entity_id: "light.wohnzimmer_stehlampe",
			name: "Stehlampe",
			icon: "mdi:floor-lamp",
			state: "off",
			area_id: "wohnzimmer"
		},
		{
			entity_id: "binary_sensor.kueche_bewegungsmelder",
			name: "Bewegungsmelder",
			icon: "mdi:motion-sensor",
			state: "off",
			area_id: "kueche"
		},
		{
			entity_id: "light.kueche_arbeitslicht",
			name: "Arbeitslicht",
			icon: "mdi:light-recessed",
			state: "off",
			area_id: "kueche"
		},
		{
			entity_id: "sun.sun",
			name: "Sonne",
			icon: "mdi:white-balance-sunny",
			state: "above_horizon",
			area_id: null
		},
		{
			entity_id: "input_boolean.nachtmodus",
			name: "Nachtmodus",
			icon: "mdi:weather-night",
			state: "off",
			area_id: null
		}
	]
}, Ie = {
	format: "ai_drafts.net",
	version: 0,
	places: [
		{
			id: "p:nachtmodus_an:triggered",
			kind: "control",
			label: "Nachtmodus um 23 Uhr ausgelöst",
			origin: { automation_id: "nachtmodus_an" }
		},
		{
			id: "p:input_boolean.nachtmodus:off",
			kind: "state",
			entity_id: "input_boolean.nachtmodus",
			state: "off",
			label: "Nachtmodus aus",
			origin: { entity_id: "input_boolean.nachtmodus" }
		},
		{
			id: "p:input_boolean.nachtmodus:on",
			kind: "state",
			entity_id: "input_boolean.nachtmodus",
			state: "on",
			label: "Nachtmodus an",
			origin: { entity_id: "input_boolean.nachtmodus" }
		},
		{
			id: "p:nachtruhe_flur:triggered",
			kind: "control",
			label: "Nachtruhe im Flur ausgelöst",
			origin: { automation_id: "nachtruhe_flur" }
		},
		{
			id: "p:light.flurlicht:on",
			kind: "state",
			entity_id: "light.flurlicht",
			state: "on",
			label: "Flurlicht an",
			origin: {
				entity_id: "light.flurlicht",
				area_id: "flur"
			}
		},
		{
			id: "p:light.flurlicht:off",
			kind: "state",
			entity_id: "light.flurlicht",
			state: "off",
			label: "Flurlicht aus",
			origin: {
				entity_id: "light.flurlicht",
				area_id: "flur"
			}
		},
		{
			id: "p:kuechenlicht_bewegung:triggered",
			kind: "control",
			label: "Küchenlicht bei Bewegung ausgelöst",
			origin: { automation_id: "kuechenlicht_bewegung" }
		},
		{
			id: "p:binary_sensor.kueche_bewegungsmelder:on",
			kind: "state",
			entity_id: "binary_sensor.kueche_bewegungsmelder",
			state: "on",
			label: "Bewegung in der Küche",
			origin: {
				entity_id: "binary_sensor.kueche_bewegungsmelder",
				area_id: "kueche"
			}
		},
		{
			id: "p:light.kueche_arbeitslicht:off",
			kind: "state",
			entity_id: "light.kueche_arbeitslicht",
			state: "off",
			label: "Arbeitslicht aus",
			origin: {
				entity_id: "light.kueche_arbeitslicht",
				area_id: "kueche"
			}
		},
		{
			id: "p:light.kueche_arbeitslicht:on",
			kind: "state",
			entity_id: "light.kueche_arbeitslicht",
			state: "on",
			label: "Arbeitslicht an",
			origin: {
				entity_id: "light.kueche_arbeitslicht",
				area_id: "kueche"
			}
		},
		{
			id: "p:kuechenlicht_bewegung:step:2",
			kind: "control",
			label: "Küchenlicht bei Bewegung: Schritt 3",
			origin: { automation_id: "kuechenlicht_bewegung" }
		},
		{
			id: "p:kinoabend:triggered",
			kind: "control",
			label: "Kinoabend ausgelöst",
			origin: { automation_id: "kinoabend" }
		},
		{
			id: "p:media_player.wohnzimmer_tv:playing",
			kind: "state",
			entity_id: "media_player.wohnzimmer_tv",
			state: "playing",
			label: "Fernseher läuft",
			origin: {
				entity_id: "media_player.wohnzimmer_tv",
				area_id: "wohnzimmer"
			}
		},
		{
			id: "p:sun.sun:below_horizon",
			kind: "state",
			entity_id: "sun.sun",
			state: "below_horizon",
			label: "Sonne unter dem Horizont",
			origin: { entity_id: "sun.sun" }
		},
		{
			id: "p:light.wohnzimmer_deckenlicht:on",
			kind: "state",
			entity_id: "light.wohnzimmer_deckenlicht",
			state: "on",
			label: "Deckenlicht an",
			origin: {
				entity_id: "light.wohnzimmer_deckenlicht",
				area_id: "wohnzimmer"
			}
		},
		{
			id: "p:light.wohnzimmer_deckenlicht:off",
			kind: "state",
			entity_id: "light.wohnzimmer_deckenlicht",
			state: "off",
			label: "Deckenlicht aus",
			origin: {
				entity_id: "light.wohnzimmer_deckenlicht",
				area_id: "wohnzimmer"
			}
		},
		{
			id: "p:kinoabend:step:1",
			kind: "control",
			label: "Kinoabend: Schritt 2",
			origin: { automation_id: "kinoabend" }
		},
		{
			id: "p:light.wohnzimmer_stehlampe:off",
			kind: "state",
			entity_id: "light.wohnzimmer_stehlampe",
			state: "off",
			label: "Stehlampe aus",
			origin: {
				entity_id: "light.wohnzimmer_stehlampe",
				area_id: "wohnzimmer"
			}
		},
		{
			id: "p:light.wohnzimmer_stehlampe:on",
			kind: "state",
			entity_id: "light.wohnzimmer_stehlampe",
			state: "on",
			label: "Stehlampe an",
			origin: {
				entity_id: "light.wohnzimmer_stehlampe",
				area_id: "wohnzimmer"
			}
		}
	],
	transitions: [
		{
			id: "t:nachtmodus_an:trigger:0",
			kind: "trigger",
			label: "Uhrzeit 23:00 Uhr",
			origin: {
				automation_id: "nachtmodus_an",
				path: "triggers[0]"
			},
			annotations: [{
				type: "event",
				value: "time 23:00:00"
			}, {
				type: "mode",
				value: "single"
			}]
		},
		{
			id: "t:nachtmodus_an:action:0",
			kind: "action",
			label: "Nachtmodus einschalten",
			origin: {
				automation_id: "nachtmodus_an",
				path: "actions[0]",
				entity_id: "input_boolean.nachtmodus"
			},
			annotations: []
		},
		{
			id: "t:nachtruhe_flur:trigger:0",
			kind: "trigger",
			label: "Flurlicht geht an",
			origin: {
				automation_id: "nachtruhe_flur",
				path: "triggers[0]",
				entity_id: "light.flurlicht",
				area_id: "flur"
			},
			annotations: [{
				type: "mode",
				value: "single"
			}]
		},
		{
			id: "t:nachtruhe_flur:action:0",
			kind: "action",
			label: "Flurlicht ausschalten",
			origin: {
				automation_id: "nachtruhe_flur",
				path: "actions[0]",
				entity_id: "light.flurlicht",
				area_id: "flur"
			},
			annotations: []
		},
		{
			id: "t:kuechenlicht_bewegung:trigger:0",
			kind: "trigger",
			label: "Bewegung in der Küche",
			origin: {
				automation_id: "kuechenlicht_bewegung",
				path: "triggers[0]",
				entity_id: "binary_sensor.kueche_bewegungsmelder",
				area_id: "kueche"
			},
			annotations: [{
				type: "mode",
				value: "restart"
			}]
		},
		{
			id: "t:kuechenlicht_bewegung:action:0",
			kind: "action",
			label: "Arbeitslicht einschalten",
			origin: {
				automation_id: "kuechenlicht_bewegung",
				path: "actions[0]",
				entity_id: "light.kueche_arbeitslicht",
				area_id: "kueche"
			},
			annotations: []
		},
		{
			id: "t:kuechenlicht_bewegung:action:2",
			kind: "action",
			label: "Arbeitslicht ausschalten",
			origin: {
				automation_id: "kuechenlicht_bewegung",
				path: "actions[2]",
				entity_id: "light.kueche_arbeitslicht",
				area_id: "kueche"
			},
			annotations: [{
				type: "delay",
				value: "00:05:00"
			}]
		},
		{
			id: "t:kinoabend:trigger:0",
			kind: "trigger",
			label: "Fernseher beginnt zu spielen",
			origin: {
				automation_id: "kinoabend",
				path: "triggers[0]",
				entity_id: "media_player.wohnzimmer_tv",
				area_id: "wohnzimmer"
			},
			annotations: [{
				type: "mode",
				value: "single"
			}]
		},
		{
			id: "t:kinoabend:action:0",
			kind: "action",
			label: "Deckenlicht ausschalten",
			origin: {
				automation_id: "kinoabend",
				path: "actions[0]",
				entity_id: "light.wohnzimmer_deckenlicht",
				area_id: "wohnzimmer"
			},
			annotations: []
		},
		{
			id: "t:kinoabend:action:1",
			kind: "action",
			label: "Stehlampe einschalten",
			origin: {
				automation_id: "kinoabend",
				path: "actions[1]",
				entity_id: "light.wohnzimmer_stehlampe",
				area_id: "wohnzimmer"
			},
			annotations: []
		}
	],
	arcs: [
		{
			source: "t:nachtmodus_an:trigger:0",
			target: "p:nachtmodus_an:triggered",
			kind: "produce"
		},
		{
			source: "p:nachtmodus_an:triggered",
			target: "t:nachtmodus_an:action:0",
			kind: "consume"
		},
		{
			source: "p:input_boolean.nachtmodus:off",
			target: "t:nachtmodus_an:action:0",
			kind: "consume"
		},
		{
			source: "t:nachtmodus_an:action:0",
			target: "p:input_boolean.nachtmodus:on",
			kind: "produce"
		},
		{
			source: "p:light.flurlicht:on",
			target: "t:nachtruhe_flur:trigger:0",
			kind: "read"
		},
		{
			source: "t:nachtruhe_flur:trigger:0",
			target: "p:nachtruhe_flur:triggered",
			kind: "produce"
		},
		{
			source: "p:input_boolean.nachtmodus:on",
			target: "t:nachtruhe_flur:trigger:0",
			kind: "read"
		},
		{
			source: "p:nachtruhe_flur:triggered",
			target: "t:nachtruhe_flur:action:0",
			kind: "consume"
		},
		{
			source: "p:light.flurlicht:on",
			target: "t:nachtruhe_flur:action:0",
			kind: "consume"
		},
		{
			source: "t:nachtruhe_flur:action:0",
			target: "p:light.flurlicht:off",
			kind: "produce"
		},
		{
			source: "p:binary_sensor.kueche_bewegungsmelder:on",
			target: "t:kuechenlicht_bewegung:trigger:0",
			kind: "read"
		},
		{
			source: "t:kuechenlicht_bewegung:trigger:0",
			target: "p:kuechenlicht_bewegung:triggered",
			kind: "produce"
		},
		{
			source: "p:kuechenlicht_bewegung:triggered",
			target: "t:kuechenlicht_bewegung:action:0",
			kind: "consume"
		},
		{
			source: "p:light.kueche_arbeitslicht:off",
			target: "t:kuechenlicht_bewegung:action:0",
			kind: "consume"
		},
		{
			source: "t:kuechenlicht_bewegung:action:0",
			target: "p:light.kueche_arbeitslicht:on",
			kind: "produce"
		},
		{
			source: "t:kuechenlicht_bewegung:action:0",
			target: "p:kuechenlicht_bewegung:step:2",
			kind: "produce"
		},
		{
			source: "p:kuechenlicht_bewegung:step:2",
			target: "t:kuechenlicht_bewegung:action:2",
			kind: "consume"
		},
		{
			source: "p:light.kueche_arbeitslicht:on",
			target: "t:kuechenlicht_bewegung:action:2",
			kind: "consume"
		},
		{
			source: "t:kuechenlicht_bewegung:action:2",
			target: "p:light.kueche_arbeitslicht:off",
			kind: "produce"
		},
		{
			source: "p:media_player.wohnzimmer_tv:playing",
			target: "t:kinoabend:trigger:0",
			kind: "read"
		},
		{
			source: "t:kinoabend:trigger:0",
			target: "p:kinoabend:triggered",
			kind: "produce"
		},
		{
			source: "p:sun.sun:below_horizon",
			target: "t:kinoabend:trigger:0",
			kind: "read"
		},
		{
			source: "p:kinoabend:triggered",
			target: "t:kinoabend:action:0",
			kind: "consume"
		},
		{
			source: "p:light.wohnzimmer_deckenlicht:on",
			target: "t:kinoabend:action:0",
			kind: "consume"
		},
		{
			source: "t:kinoabend:action:0",
			target: "p:light.wohnzimmer_deckenlicht:off",
			kind: "produce"
		},
		{
			source: "t:kinoabend:action:0",
			target: "p:kinoabend:step:1",
			kind: "produce"
		},
		{
			source: "p:kinoabend:step:1",
			target: "t:kinoabend:action:1",
			kind: "consume"
		},
		{
			source: "p:light.wohnzimmer_stehlampe:off",
			target: "t:kinoabend:action:1",
			kind: "consume"
		},
		{
			source: "t:kinoabend:action:1",
			target: "p:light.wohnzimmer_stehlampe:on",
			kind: "produce"
		}
	]
}, Le = {
	format: "ai_drafts.net",
	version: 0,
	places: [
		{
			id: "p:flurlicht_bewegung:triggered",
			kind: "control",
			label: "Flurlicht bei Bewegung ausgelöst",
			origin: { automation_id: "flurlicht_bewegung" }
		},
		{
			id: "p:binary_sensor.flur_bewegungsmelder:on",
			kind: "state",
			entity_id: "binary_sensor.flur_bewegungsmelder",
			state: "on",
			label: "Bewegung im Flur",
			origin: {
				entity_id: "binary_sensor.flur_bewegungsmelder",
				area_id: "flur"
			}
		},
		{
			id: "p:flurlicht_bewegung:step:2",
			kind: "control",
			label: "Flurlicht bei Bewegung: Schritt 3",
			origin: { automation_id: "flurlicht_bewegung" }
		}
	],
	transitions: [
		{
			id: "t:flurlicht_bewegung:trigger:0",
			kind: "trigger",
			label: "Bewegung im Flur",
			origin: {
				automation_id: "flurlicht_bewegung",
				path: "triggers[0]",
				entity_id: "binary_sensor.flur_bewegungsmelder",
				area_id: "flur"
			},
			annotations: [{
				type: "mode",
				value: "restart"
			}]
		},
		{
			id: "t:flurlicht_bewegung:action:0",
			kind: "action",
			label: "Flurlicht einschalten",
			origin: {
				automation_id: "flurlicht_bewegung",
				path: "actions[0]",
				entity_id: "light.flurlicht",
				area_id: "flur"
			},
			annotations: []
		},
		{
			id: "t:flurlicht_bewegung:action:2",
			kind: "action",
			label: "Flurlicht ausschalten",
			origin: {
				automation_id: "flurlicht_bewegung",
				path: "actions[2]",
				entity_id: "light.flurlicht",
				area_id: "flur"
			},
			annotations: [{
				type: "delay",
				value: "00:03:00"
			}]
		}
	],
	arcs: [
		{
			source: "p:binary_sensor.flur_bewegungsmelder:on",
			target: "t:flurlicht_bewegung:trigger:0",
			kind: "read"
		},
		{
			source: "t:flurlicht_bewegung:trigger:0",
			target: "p:flurlicht_bewegung:triggered",
			kind: "produce"
		},
		{
			source: "p:sun.sun:below_horizon",
			target: "t:flurlicht_bewegung:trigger:0",
			kind: "read"
		},
		{
			source: "p:flurlicht_bewegung:triggered",
			target: "t:flurlicht_bewegung:action:0",
			kind: "consume"
		},
		{
			source: "p:light.flurlicht:off",
			target: "t:flurlicht_bewegung:action:0",
			kind: "consume"
		},
		{
			source: "t:flurlicht_bewegung:action:0",
			target: "p:light.flurlicht:on",
			kind: "produce"
		},
		{
			source: "t:flurlicht_bewegung:action:0",
			target: "p:flurlicht_bewegung:step:2",
			kind: "produce"
		},
		{
			source: "p:flurlicht_bewegung:step:2",
			target: "t:flurlicht_bewegung:action:2",
			kind: "consume"
		},
		{
			source: "p:light.flurlicht:on",
			target: "t:flurlicht_bewegung:action:2",
			kind: "consume"
		},
		{
			source: "t:flurlicht_bewegung:action:2",
			target: "p:light.flurlicht:off",
			kind: "produce"
		}
	]
}, Re = Fe, ze = Ne, Be = Ie, Ve = Le, He = Pe[0], Ue = {
	title: "AI Drafts",
	version: "Version",
	modelSource: "Model source",
	model: "Model",
	sourceAiTask: "Home Assistant AI Task",
	sourceOpenai: "OpenAI-compatible server",
	preferredAiTask: "preferred AI Task entity",
	loading: "Loading…",
	error: "Could not load AI Drafts information.",
	retry: "Retry",
	outdatedTitle: "This interface is outdated",
	outdatedText: "AI Drafts was updated, but this page is still running the old version. Reload the page to use the new one.",
	outdatedReload: "Reload page",
	demoTitle: "Example data",
	demoText: "This view shows fixed example data, not your house. It reads nothing from Home Assistant and writes nothing.",
	tabRequest: "Request and history",
	tabProposal: "Proposal and findings",
	tabDomain: "Domain view",
	tabInventory: "Inventory",
	requestHeading: "New request",
	requestLabel: "What should Home Assistant do?",
	requestPlaceholder: "Describe the automation in your own words",
	useExample: "Use the example request",
	createDraft: "Create draft",
	drafting: "Creating draft…",
	draftingNote: "The model is working. With a real model this can take up to a minute. Please keep this page open.",
	historyHeading: "History",
	historyEmpty: "No proposals yet.",
	historyEmptyHint: "Describe an automation above. The draft shows up here once it is created.",
	historyLoading: "Loading history…",
	historyError: "The history could not be loaded.",
	historyOpenHint: "Click an entry to open it in the proposal view.",
	modelLabel: "Model for this draft",
	modelDefaultMark: "default",
	modelPreferred: "Home Assistant's preferred AI Task entity",
	modelsLoading: "Loading models…",
	modelsError: "The models could not be loaded.",
	modelsUnavailable: "The model list is not available",
	modelNote: "Applies to the drafts you create from now on, as long as this page is open. The default is set in the integration settings (Reconfigure).",
	historyModel: "Model",
	currentBadge: "Open",
	roundsLabel: (e) => `${e} repair ${e === 1 ? "round" : "rounds"}`,
	statusDraft: "Draft",
	statusChecked: "Checked",
	statusFailed: "Failed",
	statusApplied: "Applied",
	statusReverted: "Reverted",
	statusDiscarded: "Discarded",
	errorCode: "Error code",
	errBusy: "Another draft is still running. Try again when it has finished.",
	errModel: "The model could not be reached or gave no usable answer. The failed proposal is stored and appears in the history.",
	errInvalidModel: "The chosen model cannot be used with the configured model source.",
	errNotLoaded: "AI Drafts is not set up. Add the integration under Settings, Devices and services.",
	errUnknown: "Something unexpected went wrong.",
	errApplyBlocked: "Applying is blocked: the proposal has error findings.",
	errApplyFailed: "Applying failed.",
	errRevertRefused: "Reverting was refused. Nothing was changed.",
	errWrongState: "That is not possible in the current status. The view now shows the current status.",
	errNotFound: "This proposal no longer exists.",
	noProposal: "No proposal is open. Create a draft from a request, or open an entry from the history.",
	toRequest: "To the request",
	proposalHeading: "Proposal",
	metaModel: "Model",
	metaRounds: "Repair rounds",
	metaCreated: "Created",
	metaDecided: "Decided",
	modelUnknown: "unknown",
	partsLabel: "Representation",
	partDescription: "In words",
	partYaml: "YAML",
	automationHeading: (e) => `Automation “${e}”`,
	automationUnnamed: "Automation without a name",
	triggersHeading: "Triggers",
	conditionsHeading: "Conditions",
	actionsHeading: "Actions",
	none: "none",
	modeLabel: "Mode",
	modeRestart: "restart: a new trigger starts the run again",
	modeSingle: "single: a running run is not interrupted",
	otherFieldsHeading: "Further fields",
	operationOther: (e, t) => `Operation “${e}” on “${t}” (not described)`,
	yamlNote: "Every line is an addition: this proposal creates a new automation and changes nothing that exists.",
	findingsHeading: "Findings",
	noFindings: "No findings.",
	noFindingsDetail: "The checks found nothing to report.",
	copyYaml: "Copy",
	copiedYaml: "Copied",
	severityError: "Error",
	severityWarning: "Warning",
	severityInfo: "Note",
	pathLabel: "Path",
	showInDomain: "Show in domain view",
	failedTitle: "This proposal cannot be applied",
	failedText: (e, t) => `The check still found ${t} ${t === 1 ? "error" : "errors"} after ${e} repair ${e === 1 ? "round" : "rounds"}, or the model gave no usable answer. The errors are listed under Findings.`,
	draftNote: "This draft was not checked to the end. It cannot be applied, only discarded.",
	decisionHeading: "Decision",
	apply: "Apply",
	discard: "Discard",
	revert: "Revert",
	applying: "Applying…",
	discarding: "Discarding…",
	reverting: "Reverting…",
	applyEffect: "Apply writes the automation into automations.yaml and loads it in Home Assistant.",
	revertEffect: "Revert takes the automation out of automations.yaml again, unless it was edited by hand since.",
	stateApplied: "Applied: the automation is now in automations.yaml and loaded.",
	stateReverted: "Reverted: the automation was taken out of automations.yaml again.",
	stateDiscarded: "Discarded. Nothing was written.",
	createdAutomation: "Created automation",
	automationId: "ID",
	openInEditor: "Open in the Home Assistant editor",
	quote: (e) => `“${e}”`,
	clock: (e) => e,
	sunrise: "sunrise",
	sunset: "sunset",
	triggerFor: (e) => ` and stays so for ${e}`,
	conditionFor: (e) => ` for at least ${e}`,
	changes: (e) => `${e} changes`,
	changesTo: (e, t) => `${e} changes to ${t}`,
	changesFrom: (e, t) => `${e} changes from ${t}`,
	changesFromTo: (e, t, n) => `${e} changes from ${t} to ${n}`,
	timeAt: (e) => `at ${e}`,
	timeAtEntity: (e) => `at the time set by ${e}`,
	sunTrigger: (e, t, n) => t === "" ? `at ${e}` : `${t} ${n ? "before" : "after"} ${e}`,
	triggerNumeric: (e, t, n) => t !== null && n !== null ? `${e} enters the range between ${t} and ${n}` : t === null ? `${e} drops below ${n}` : `${e} rises above ${t}`,
	isState: (e, t) => `${e} is ${t}`,
	conditionNumeric: (e, t, n) => t !== null && n !== null ? `${e} is between ${t} and ${n}` : t === null ? `${e} is below ${n}` : `${e} is above ${t}`,
	sunCondition: (e, t, n, r) => n === "" ? `${e} ${t}` : `${e === "after" ? "from" : "until"} ${n} ${r ? "before" : "after"} ${t}`,
	timeCondition: (e, t) => `${e} ${t}`,
	timeConditionEntity: (e, t) => `${e} the time set by ${t}`,
	onWeekdays: (e) => `on ${e}`,
	turnOn: (e) => `Turns on ${e}`,
	turnOff: (e) => `Turns off ${e}`,
	toggle: (e) => `Toggles ${e}`,
	callOn: (e, t) => `Calls ${e} on ${t}`,
	call: (e) => `Calls ${e}`,
	waits: (e) => `Waits ${e}`,
	unknownTrigger: "Trigger (not described)",
	unknownTriggerOf: (e) => `Trigger of type “${e}” (not described)`,
	unknownCondition: "Condition (not described)",
	unknownConditionOf: (e) => `Condition of type “${e}” (not described)`,
	unknownAction: "Step (not described)",
	unknownActionOf: (e) => `Step “${e}” (not described)`,
	fragmentYaml: "YAML fragment",
	fragmentTarget: "Further target fields",
	fragmentData: "Data",
	viewHouse: "House",
	viewNet: "Net",
	viewMode: "Representation",
	noRoom: "No room",
	proposalBadge: "Proposal",
	markExample: "Mark the elements of the example finding",
	marksActive: "The elements named by the example finding are marked.",
	focusActive: (e) => `Focus: ${e}`,
	clear: "Clear",
	legendHeading: "Legend",
	legendExisting: "Existing automation",
	legendProposal: "Example proposal",
	legendMarked: "Named by the example finding",
	legendCondition: "Condition",
	legendPlaceState: "State place",
	legendPlaceControl: "Control place",
	legendTransition: "Transition",
	legendRead: "reads",
	legendConsume: "consumes",
	legendProduce: "produces",
	netHeading: "Underlying net (format version 0, provisional)",
	netHint: "One diagram per automation. State places that several automations use are repeated in each diagram.",
	annotationMode: "mode",
	annotationDelay: "delay",
	annotationEvent: "event",
	annotationGuard: "guard",
	houseLabel: "Diagram of the house with rooms, devices and automations",
	netLabel: (e) => `Net of the automation ${e}`,
	inventoryHeading: "Existing automations",
	inventoryEmpty: "No automations.",
	showInDomainView: "Show in domain view",
	dependenciesHeading: "Dependencies",
	noDependencies: "No dependencies on other automations.",
	writesFor: (e, t, n) => `Writes “${e}”, which “${t}” uses as ${n}.`,
	readsFrom: (e, t, n) => `Uses “${e}” as ${n}, written by “${t}”.`,
	roleTrigger: "trigger",
	roleCondition: "condition",
	summaryArrow: "→",
	trigger: "Trigger",
	effect: "Effect",
	condition: "Condition",
	room: "Room",
	rooms: "Rooms",
	after: (e) => `after ${e}`,
	unitHour: ["hour", "hours"],
	unitMinute: ["minute", "minutes"],
	unitSecond: ["second", "seconds"]
}, We = {
	title: "AI Drafts",
	version: "Version",
	modelSource: "Modellquelle",
	model: "Modell",
	sourceAiTask: "Home-Assistant-AI-Task",
	sourceOpenai: "OpenAI-kompatibler Server",
	preferredAiTask: "bevorzugte AI-Task-Entität",
	loading: "Lädt…",
	error: "Die Informationen zu AI Drafts konnten nicht geladen werden.",
	retry: "Erneut versuchen",
	outdatedTitle: "Diese Oberfläche ist veraltet",
	outdatedText: "AI Drafts wurde aktualisiert, aber diese Seite läuft noch mit der alten Version. Lade die Seite neu, um die neue zu verwenden.",
	outdatedReload: "Seite neu laden",
	demoTitle: "Beispieldaten",
	demoText: "Diese Ansicht zeigt feste Beispieldaten, nicht dein Haus. Sie liest nichts aus Home Assistant und schreibt nichts.",
	tabRequest: "Anfrage und Verlauf",
	tabProposal: "Vorschlag und Befunde",
	tabDomain: "Domänenansicht",
	tabInventory: "Bestand",
	requestHeading: "Neue Anfrage",
	requestLabel: "Was soll Home Assistant tun?",
	requestPlaceholder: "Beschreibe die Automation in eigenen Worten",
	useExample: "Beispielanfrage übernehmen",
	createDraft: "Entwurf erstellen",
	drafting: "Entwurf wird erstellt…",
	draftingNote: "Das Modell arbeitet. Mit einem echten Modell kann das bis zu eine Minute dauern. Bitte lass diese Seite offen.",
	historyHeading: "Verlauf",
	historyEmpty: "Noch keine Vorschläge.",
	historyEmptyHint: "Beschreibe oben eine Automation. Der Entwurf erscheint hier, sobald er erstellt ist.",
	historyLoading: "Verlauf lädt…",
	historyError: "Der Verlauf konnte nicht geladen werden.",
	historyOpenHint: "Ein Klick auf einen Eintrag öffnet ihn in der Ansicht „Vorschlag und Befunde“.",
	modelLabel: "Modell für diesen Entwurf",
	modelDefaultMark: "Standard",
	modelPreferred: "Bevorzugte AI-Task-Entität von Home Assistant",
	modelsLoading: "Modelle werden geladen…",
	modelsError: "Die Modelle konnten nicht geladen werden.",
	modelsUnavailable: "Die Modellliste ist nicht verfügbar",
	modelNote: "Gilt für die Entwürfe, die du ab jetzt erstellst, solange diese Seite geöffnet ist. Der Standard wird in den Einstellungen der Integration festgelegt (Neu konfigurieren).",
	historyModel: "Modell",
	currentBadge: "Geöffnet",
	roundsLabel: (e) => `${e} ${e === 1 ? "Reparaturrunde" : "Reparaturrunden"}`,
	statusDraft: "Entwurf",
	statusChecked: "Geprüft",
	statusFailed: "Fehlgeschlagen",
	statusApplied: "Übernommen",
	statusReverted: "Rückgängig gemacht",
	statusDiscarded: "Verworfen",
	errorCode: "Fehlercode",
	errBusy: "Es läuft noch ein anderer Entwurf. Versuche es erneut, wenn er fertig ist.",
	errModel: "Das Modell war nicht erreichbar oder hat keine brauchbare Antwort geliefert. Der fehlgeschlagene Vorschlag ist gespeichert und steht im Verlauf.",
	errInvalidModel: "Das gewählte Modell passt nicht zur eingestellten Modellquelle.",
	errNotLoaded: "AI Drafts ist nicht eingerichtet. Füge die Integration unter Einstellungen, Geräte und Dienste hinzu.",
	errUnknown: "Es ist etwas Unerwartetes schiefgegangen.",
	errApplyBlocked: "Übernehmen ist gesperrt: Der Vorschlag hat Fehler-Befunde.",
	errApplyFailed: "Das Übernehmen ist fehlgeschlagen.",
	errRevertRefused: "Rückgängig wurde abgelehnt. Es wurde nichts geändert.",
	errWrongState: "Das ist im aktuellen Status nicht möglich. Die Ansicht zeigt jetzt den aktuellen Status.",
	errNotFound: "Diesen Vorschlag gibt es nicht mehr.",
	noProposal: "Es ist kein Vorschlag geöffnet. Erstelle einen Entwurf aus einer Anfrage oder öffne einen Eintrag aus dem Verlauf.",
	toRequest: "Zur Anfrage",
	proposalHeading: "Vorschlag",
	metaModel: "Modell",
	metaRounds: "Reparaturrunden",
	metaCreated: "Erstellt",
	metaDecided: "Entschieden",
	modelUnknown: "unbekannt",
	partsLabel: "Darstellung",
	partDescription: "In Worten",
	partYaml: "YAML",
	automationHeading: (e) => `Automation „${e}“`,
	automationUnnamed: "Automation ohne Namen",
	triggersHeading: "Auslöser",
	conditionsHeading: "Bedingungen",
	actionsHeading: "Aktionen",
	none: "keine",
	modeLabel: "Modus",
	modeRestart: "restart: ein neuer Auslöser startet den Ablauf neu",
	modeSingle: "single: ein laufender Ablauf wird nicht unterbrochen",
	otherFieldsHeading: "Weitere Felder",
	operationOther: (e, t) => `Vorgang „${e}“ auf „${t}“ (nicht beschrieben)`,
	yamlNote: "Jede Zeile ist eine Ergänzung: Dieser Vorschlag legt eine neue Automation an und ändert nichts Bestehendes.",
	findingsHeading: "Befunde",
	noFindings: "Keine Befunde.",
	noFindingsDetail: "Die Prüfungen haben nichts beanstandet.",
	copyYaml: "Kopieren",
	copiedYaml: "Kopiert",
	severityError: "Fehler",
	severityWarning: "Warnung",
	severityInfo: "Hinweis",
	pathLabel: "Pfad",
	showInDomain: "In der Domänenansicht zeigen",
	failedTitle: "Dieser Vorschlag lässt sich nicht übernehmen",
	failedText: (e, t) => `Die Prüfung hat nach ${e} ${e === 1 ? "Reparaturrunde" : "Reparaturrunden"} noch ${t} Fehler gefunden, oder das Modell hat keine brauchbare Antwort geliefert. Die Fehler stehen unter „Befunde“.`,
	draftNote: "Dieser Entwurf wurde nicht zu Ende geprüft. Er lässt sich nicht übernehmen, nur verwerfen.",
	decisionHeading: "Entscheidung",
	apply: "Übernehmen",
	discard: "Verwerfen",
	revert: "Rückgängig",
	applying: "Wird übernommen…",
	discarding: "Wird verworfen…",
	reverting: "Wird rückgängig gemacht…",
	applyEffect: "Übernehmen schreibt die Automation in die Datei automations.yaml und lädt sie in Home Assistant.",
	revertEffect: "Rückgängig nimmt die Automation wieder aus automations.yaml, sofern sie seitdem nicht von Hand geändert wurde.",
	stateApplied: "Übernommen: Die Automation steht jetzt in automations.yaml und ist geladen.",
	stateReverted: "Rückgängig gemacht: Die Automation wurde wieder aus automations.yaml genommen.",
	stateDiscarded: "Verworfen. Es wurde nichts geschrieben.",
	createdAutomation: "Angelegte Automation",
	automationId: "ID",
	openInEditor: "Im Editor von Home Assistant öffnen",
	quote: (e) => `„${e}“`,
	clock: (e) => `${e} Uhr`,
	sunrise: "Sonnenaufgang",
	sunset: "Sonnenuntergang",
	triggerFor: (e) => ` und bleibt so für ${e}`,
	conditionFor: (e) => ` seit mindestens ${e}`,
	changes: (e) => `${e} ändert sich`,
	changesTo: (e, t) => `${e} wechselt zu ${t}`,
	changesFrom: (e, t) => `${e} wechselt von ${t}`,
	changesFromTo: (e, t, n) => `${e} wechselt von ${t} zu ${n}`,
	timeAt: (e) => `um ${e}`,
	timeAtEntity: (e) => `zur Uhrzeit von ${e}`,
	sunTrigger: (e, t, n) => t === "" ? `bei ${e}` : `${t} ${n ? "vor" : "nach"} ${e}`,
	triggerNumeric: (e, t, n) => t !== null && n !== null ? `${e} gelangt in den Bereich zwischen ${t} und ${n}` : t === null ? `${e} fällt unter ${n}` : `${e} steigt über ${t}`,
	isState: (e, t) => `${e} ist ${t}`,
	conditionNumeric: (e, t, n) => t !== null && n !== null ? `${e} liegt zwischen ${t} und ${n}` : t === null ? `${e} liegt unter ${n}` : `${e} liegt über ${t}`,
	sunCondition: (e, t, n, r) => n === "" ? `${e === "after" ? "nach" : "vor"} ${t}` : `${e === "after" ? "ab" : "bis"} ${n} ${r ? "vor" : "nach"} ${t}`,
	timeCondition: (e, t) => `${e === "after" ? "nach" : "vor"} ${t}`,
	timeConditionEntity: (e, t) => `${e === "after" ? "nach" : "vor"} der Uhrzeit von ${t}`,
	onWeekdays: (e) => `an ${e}`,
	turnOn: (e) => `Schaltet ${e} ein`,
	turnOff: (e) => `Schaltet ${e} aus`,
	toggle: (e) => `Schaltet ${e} um`,
	callOn: (e, t) => `Ruft ${e} auf für ${t}`,
	call: (e) => `Ruft ${e} auf`,
	waits: (e) => `Wartet ${e}`,
	unknownTrigger: "Auslöser (nicht beschrieben)",
	unknownTriggerOf: (e) => `Auslöser vom Typ „${e}“ (nicht beschrieben)`,
	unknownCondition: "Bedingung (nicht beschrieben)",
	unknownConditionOf: (e) => `Bedingung vom Typ „${e}“ (nicht beschrieben)`,
	unknownAction: "Schritt (nicht beschrieben)",
	unknownActionOf: (e) => `Schritt „${e}“ (nicht beschrieben)`,
	fragmentYaml: "YAML-Ausschnitt",
	fragmentTarget: "Weitere Zielangaben",
	fragmentData: "Daten",
	viewHouse: "Haus",
	viewNet: "Netz",
	viewMode: "Darstellung",
	noRoom: "Ohne Raum",
	proposalBadge: "Vorschlag",
	markExample: "Elemente des Beispielbefunds markieren",
	marksActive: "Die vom Beispielbefund genannten Elemente sind markiert.",
	focusActive: (e) => `Fokus: ${e}`,
	clear: "Aufheben",
	legendHeading: "Legende",
	legendExisting: "Bestehende Automation",
	legendProposal: "Beispielvorschlag",
	legendMarked: "Vom Beispielbefund genannt",
	legendCondition: "Bedingung",
	legendPlaceState: "Zustandsstelle",
	legendPlaceControl: "Kontrollstelle",
	legendTransition: "Transition",
	legendRead: "liest",
	legendConsume: "verbraucht",
	legendProduce: "erzeugt",
	netHeading: "Zugrunde liegendes Netz (Format Version 0, vorläufig)",
	netHint: "Ein Diagramm je Automation. Zustandsstellen, die mehrere Automationen nutzen, stehen in jedem Diagramm.",
	annotationMode: "Modus",
	annotationDelay: "Wartezeit",
	annotationEvent: "Ereignis",
	annotationGuard: "Wächter",
	houseLabel: "Diagramm des Hauses mit Räumen, Geräten und Automationen",
	netLabel: (e) => `Netz der Automation ${e}`,
	inventoryHeading: "Bestehende Automationen",
	inventoryEmpty: "Keine Automationen.",
	showInDomainView: "In der Domänenansicht zeigen",
	dependenciesHeading: "Abhängigkeiten",
	noDependencies: "Keine Abhängigkeiten zu anderen Automationen.",
	writesFor: (e, t, n) => `Schreibt „${e}“, das „${t}“ als ${n} nutzt.`,
	readsFrom: (e, t, n) => `Nutzt „${e}“ als ${n}, geschrieben von „${t}“.`,
	roleTrigger: "Auslöser",
	roleCondition: "Bedingung",
	summaryArrow: "→",
	trigger: "Auslöser",
	effect: "Wirkung",
	condition: "Bedingung",
	room: "Raum",
	rooms: "Räume",
	after: (e) => `nach ${e}`,
	unitHour: ["Stunde", "Stunden"],
	unitMinute: ["Minute", "Minuten"],
	unitSecond: ["Sekunde", "Sekunden"]
};
function Ge(e) {
	return e?.toLowerCase().startsWith("de") ? We : Ue;
}
function Ke(e, t) {
	return {
		draft: e.statusDraft,
		checked: e.statusChecked,
		failed: e.statusFailed,
		applied: e.statusApplied,
		reverted: e.statusReverted,
		discarded: e.statusDiscarded
	}[t] ?? t;
}
function qe(e, t) {
	let n = e?.toLowerCase().startsWith("de");
	return {
		on: ["on", "an"],
		off: ["off", "aus"],
		playing: ["playing", "läuft"],
		above_horizon: ["above horizon", "über dem Horizont"],
		below_horizon: ["below horizon", "unter dem Horizont"]
	}[t]?.[+!!n] ?? t;
}
// src/logic/describe.ts
function Je(e, t) {
	let n = (e) => t.areas.find((t) => t.id === e)?.name ?? null, r = e.triggers.map((e) => ({
		text: e.label,
		room: n(e.areaId)
	})), i = e.conditions.map((e) => ({
		text: e.label,
		room: n(e.areaId)
	})), a = e.effects.map((e) => ({
		text: e.label,
		room: n(e.areaId),
		delay: e.delay
	}));
	return {
		triggers: r,
		conditions: i,
		effects: a,
		rooms: [...new Set([...r, ...a].map((e) => e.room).filter((e) => e !== null))]
	};
}
// src/logic/net.ts
function Ye(...e) {
	return {
		format: e[0].format,
		version: e[0].version,
		places: e.flatMap((e) => e.places),
		transitions: e.flatMap((e) => e.transitions),
		arcs: e.flatMap((e) => e.arcs)
	};
}
function Xe(e, t) {
	return e.annotations.find((e) => e.type === t)?.value ?? null;
}
function Ze(e) {
	let t = new Map(e.places.map((e) => [e.id, e])), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
	for (let t of e.arcs) {
		let e = t.kind === "produce" ? t.source : t.target, n = r.get(e) ?? [];
		n.push(t), r.set(e, n);
	}
	for (let i of e.transitions) {
		let e = i.origin.automation_id;
		if (!e) continue;
		let a = n.get(e);
		a || (a = {
			id: e,
			mode: null,
			triggers: [],
			conditions: [],
			effects: [],
			reads: [],
			writes: []
		}, n.set(e, a));
		let o = r.get(i.id) ?? [];
		if (i.kind === "trigger") {
			a.mode ??= Xe(i, "mode");
			let e = o.filter((e) => e.kind === "read").map((e) => t.get(e.source)).filter((e) => e?.kind === "state"), n = e.find((e) => e.entity_id === i.origin.entity_id);
			a.triggers.push({
				transitionId: i.id,
				label: i.label,
				entityId: i.origin.entity_id ?? null,
				areaId: i.origin.area_id ?? null,
				placeId: n?.id ?? null,
				event: Xe(i, "event")
			});
			for (let t of e) t !== n && (a.conditions.some((e) => e.placeId === t.id) || a.conditions.push({
				placeId: t.id,
				label: t.label,
				entityId: t.entity_id ?? "",
				areaId: t.origin.area_id ?? null
			}));
		} else for (let e of o) {
			let n = t.get(e.target);
			e.kind === "produce" && n?.kind === "state" && a.effects.push({
				transitionId: i.id,
				label: i.label,
				entityId: n.entity_id ?? "",
				areaId: n.origin.area_id ?? null,
				placeId: n.id,
				delay: Xe(i, "delay")
			});
		}
	}
	for (let e of n.values()) e.reads = Qe([...e.triggers.flatMap((e) => e.placeId ? [e.placeId] : []), ...e.conditions.map((e) => e.placeId)]), e.writes = Qe(e.effects.map((e) => e.placeId));
	return [...n.values()];
}
function Qe(e) {
	return [...new Set(e)];
}
function $e(e) {
	let t = [];
	for (let n of e) for (let r of e) if (n.id !== r.id) for (let e of n.writes) {
		if (!r.reads.includes(e)) continue;
		let i = r.triggers.some((t) => t.placeId === e);
		t.push({
			from: n.id,
			to: r.id,
			placeId: e,
			role: i ? "trigger" : "condition"
		});
	}
	return t;
}
function et(e, t) {
	let n = {
		entityIds: /* @__PURE__ */ new Set(),
		automationIds: /* @__PURE__ */ new Set(),
		placeIds: /* @__PURE__ */ new Set(),
		transitionIds: /* @__PURE__ */ new Set()
	}, r = new Map(e.places.map((e) => [e.id, e])), i = new Map(e.transitions.map((e) => [e.id, e]));
	for (let e of t) {
		let t = r.get(e) ?? i.get(e);
		t && (r.has(e) ? n.placeIds.add(e) : n.transitionIds.add(e), t.origin.entity_id && n.entityIds.add(t.origin.entity_id), t.origin.automation_id && n.automationIds.add(t.origin.automation_id));
	}
	return n;
}
var tt = {
	entityIds: /* @__PURE__ */ new Set(),
	automationIds: /* @__PURE__ */ new Set(),
	placeIds: /* @__PURE__ */ new Set(),
	transitionIds: /* @__PURE__ */ new Set()
};
// src/logic/text.ts
function nt(e, t, n) {
	let r = [], i = "";
	for (let n of e.split(/\s+/).filter(Boolean)) {
		let e = i ? `${i} ${n}` : n;
		e.length <= t || !i ? i = e : (r.push(i), i = n);
	}
	if (i && r.push(i), r.length > n) {
		let e = r.slice(0, n);
		return e[n - 1] = `${e[n - 1].slice(0, t - 1)}…`, e;
	}
	return r;
}
function rt(e, t) {
	let n = /^(\d+):(\d{2}):(\d{2})$/.exec(e);
	if (!n) return e;
	let r = [], i = (e, [t, n]) => {
		e > 0 && r.push(`${e} ${e === 1 ? t : n}`);
	};
	return i(Number(n[1]), t.hour), i(Number(n[2]), t.minute), i(Number(n[3]), t.second), r.join(" ") || e;
}
var it = 12, at = 12, ot = 180, st = 204, H = 16, ct = 26;
function lt(e, t) {
	return e ?? `event:${t}`;
}
function ut(e, t, n, r, i = "mdi:clock-outline") {
	let a = e.areas.map((e) => ({
		id: e.id,
		name: e.name,
		icon: e.icon
	}));
	a.splice(Math.floor(a.length / 2), 0, {
		id: null,
		name: null,
		icon: "mdi:home-outline"
	});
	let o = new Map(a.map((e, t) => [e.id, t])), s = o.get(null) ?? 0, c = /* @__PURE__ */ new Map(), l = a.map(() => []), u = (e, t, n) => {
		c.set(e, {
			key: e,
			col: t,
			...n
		}), l[t].push(e);
	}, d = (e) => o.get(e.area_id) ?? s;
	for (let t of e.entities) u(t.entity_id, d(t), {
		entityId: t.entity_id,
		name: t.name,
		icon: t.icon,
		state: t.state
	});
	for (let e of t) for (let t of e.triggers) t.entityId === null && u(lt(null, t.transitionId), s, {
		entityId: null,
		name: r(t.transitionId),
		icon: i,
		state: ""
	});
	let f = (e, t) => t.some((t) => t.channel === e), p = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = [
			...e.triggers.map((e) => c.get(lt(e.entityId, e.transitionId))?.col),
			...e.effects.map((e) => c.get(e.entityId)?.col),
			...e.conditions.map((e) => c.get(e.entityId)?.col)
		].filter((e) => e !== void 0), n = e.triggers.map((e) => c.get(lt(e.entityId, e.transitionId))?.col).find((e) => e !== void 0) ?? 0, r = t.filter((e) => e < n).length, i = t.filter((e) => e > n).length, o = r > i || r === i && n === a.length - 1;
		p.set(e.id, o ? n : n + 1);
	}
	let m = [...p.values()].map((e) => ({ channel: e })), h = f(0, m) ? st : 0, g = (e) => H + h + e * 384, ee = (e) => g(e) - st / 2, _ = f(a.length, m) ? st : 0, v = [], y = [], b = 0;
	a.forEach((e, t) => {
		let n = l[t], r = 48 + n.length * 64 - it + at;
		y.push({
			id: e.id,
			name: e.name,
			icon: e.icon,
			col: t,
			x: g(t),
			y: H,
			w: ot,
			h: r
		}), n.forEach((e, n) => {
			let r = c.get(e);
			r && v.push({
				...r,
				x: g(t) + at,
				y: 64 + n * 64
			});
		}), b = Math.max(b, H + r);
	});
	let x = new Map(v.map((e) => [e.key, e])), S = [];
	for (let e of t) {
		for (let t of e.triggers) S.push({
			automationId: e.id,
			kind: "trigger",
			tileKey: lt(t.entityId, t.transitionId)
		});
		for (let t of e.effects) S.push({
			automationId: e.id,
			kind: "effect",
			tileKey: t.entityId
		});
		for (let t of e.conditions) S.push({
			automationId: e.id,
			kind: "condition",
			tileKey: t.entityId
		});
	}
	let C = [], w = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = S.filter((t) => t.automationId === e.id).map((e) => x.get(e.tileKey)).filter((e) => e !== void 0).map((e) => e.y + 26), n = t.length ? t.reduce((e, t) => e + t, 0) / t.length : H, r = p.get(e.id) ?? 0;
		w.set(r, [...w.get(r) ?? [], {
			id: e.id,
			want: n
		}]);
	}
	for (let [e, t] of w) {
		t.sort((e, t) => e.want - t.want || e.id.localeCompare(t.id));
		let r = H;
		for (let i of t) {
			let t = Math.max(r, i.want - 23);
			C.push({
				automationId: i.id,
				channel: e,
				x: ee(e) - 70,
				y: t,
				lines: nt(n(i.id), 18, 2)
			}), r = t + 46 + ct, b = Math.max(b, t + 46 + H);
		}
	}
	let T = new Map(C.map((e) => [e.automationId, e])), E = [];
	for (let e of S) {
		let t = x.get(e.tileKey), n = T.get(e.automationId);
		if (!t || !n) continue;
		let r = n.x + 70 >= t.x + 78 ? 1 : -1;
		E.push({
			link: e,
			tile: t,
			side: r,
			hub: n
		});
	}
	let D = /* @__PURE__ */ new Map();
	for (let e of E) {
		let t = `${e.tile.key}|${e.side}`;
		D.set(t, [...D.get(t) ?? [], e]);
	}
	let O = /* @__PURE__ */ new Map();
	for (let e of E) {
		let t = `${e.hub.automationId}|${-e.side}`;
		O.set(t, [...O.get(t) ?? [], e]);
	}
	let te = (e, t, n, r) => n + r * (e.indexOf(t) + 1) / (e.length + 1), ne = E.map((e) => {
		let t = D.get(`${e.tile.key}|${e.side}`) ?? [e], n = O.get(`${e.hub.automationId}|${-e.side}`) ?? [e], r = e.side === 1 ? e.tile.x + 156 : e.tile.x, i = te(t, e, e.tile.y, 52), a = e.side === 1 ? e.hub.x : e.hub.x + 140, o = te(n, e, e.hub.y, 46), [s, c, l, u, d, f] = e.link.kind === "effect" ? [
			a,
			o,
			r,
			i,
			-e.side,
			e.side
		] : [
			r,
			i,
			a,
			o,
			e.side,
			-e.side
		], p = Math.max(24, Math.abs(l - s) / 2), m = `M${s},${c} C${s + d * p},${c} ${l + f * p},${u} ${l},${u}`;
		return {
			automationId: e.link.automationId,
			kind: e.link.kind,
			tileKey: e.link.tileKey,
			d: m
		};
	});
	return {
		width: g(a.length - 1) + ot + _ + H,
		height: b + H,
		rooms: y,
		tiles: v,
		hubs: C,
		edges: ne
	};
}
var dt = 84, ft = 40;
function pt(e, t) {
	let n = e.transitions.filter((e) => e.origin.automation_id === t), r = new Set(n.map((e) => e.id)), i = e.arcs.filter((e) => r.has(e.kind === "produce" ? e.source : e.target)), a = new Set(i.map((e) => e.kind === "produce" ? e.target : e.source));
	return {
		transitions: n,
		arcs: i,
		places: e.places.filter((e) => a.has(e.id) || e.origin.automation_id === t)
	};
}
function mt(e, t) {
	let { transitions: n, arcs: r, places: i } = pt(e, t), a = new Map(i.map((e) => [e.id, e])), o = new Map(n.map((e) => [e.id, e])), s = /* @__PURE__ */ new Map(), c = n.filter((e) => e.kind === "trigger"), l = n.filter((e) => e.kind === "action"), u = /* @__PURE__ */ new Set();
	c.forEach((e) => {
		s.set(e.id, 1), u.add(e.id);
	}), l.forEach((e, t) => {
		s.set(e.id, 3 + 2 * t), u.add(e.id);
	});
	for (let e of i) {
		if (e.kind !== "control") continue;
		let t = r.filter((t) => t.kind === "produce" && t.target === e.id), n = Math.max(0, ...t.map((e) => s.get(e.source) ?? 0)) + 1;
		s.set(e.id, n), u.add(e.id);
	}
	for (let e of i) {
		if (e.kind !== "state") continue;
		let t = r.filter((t) => t.kind !== "produce" && t.source === e.id), n = r.filter((t) => t.kind === "produce" && t.target === e.id);
		t.length ? s.set(e.id, Math.min(...t.map((e) => s.get(e.target) ?? 1)) - 1) : s.set(e.id, Math.max(...n.map((e) => s.get(e.source) ?? 0)) + 1);
	}
	let d = (e) => r.filter((t) => t.source === e.id || t.target === e.id).every((e) => e.kind === "read"), f = /* @__PURE__ */ new Map(), p = (e) => {
		let t = f.get(e);
		return t || (t = {
			up: [],
			mid: [],
			down: []
		}, f.set(e, t)), t;
	}, m = [...n.map((e) => e.id), ...i.map((e) => e.id)];
	for (let e of m) {
		let t = s.get(e) ?? 0, n = a.get(e);
		u.has(e) ? p(t).mid.push(e) : n && d(n) ? p(t).up.push(e) : p(t).down.push(e);
	}
	let h = Math.max(0, ...[...f.values()].map((e) => e.up.length)), g = Math.max(1, ...[...f.values()].map((e) => e.mid.length)), ee = Math.max(0, ...[...f.values()].map((e) => e.down.length)), _ = ft + h * 120, v = /* @__PURE__ */ new Map();
	for (let [e, t] of f) {
		let n = dt + e * 150;
		t.up.forEach((e, r) => v.set(e, {
			x: n,
			y: _ - (t.up.length - r) * 120
		})), t.mid.forEach((e, t) => v.set(e, {
			x: n,
			y: _ + t * 120
		})), t.down.forEach((e, t) => v.set(e, {
			x: n,
			y: _ + g * 120 + t * 120
		}));
	}
	let y = [], b = (e) => {
		let t = v.get(e);
		if (!t) return null;
		let n = a.get(e), r = o.get(e), i = n?.label ?? r?.label ?? e;
		return {
			id: e,
			shape: n ? "place" : "transition",
			kind: n?.kind ?? r?.kind ?? "",
			x: t.x,
			y: t.y,
			lines: nt(i, 22, 2),
			annotations: r?.annotations ?? []
		};
	};
	for (let e of m) {
		let t = b(e);
		t && y.push(t);
	}
	let x = [];
	for (let e of r) {
		let t = v.get(e.source), n = v.get(e.target);
		if (!t || !n) continue;
		a.has(e.source), a.has(e.target);
		let r = n.x <= t.x, i = r ? -1 : 1, o = t.x + i * 20, s = n.x - i * 20, c = Math.max(24, Math.abs(s - o) / 2), l = r ? 66 : 0, u = `M${o},${t.y} C${o + i * c},${t.y + l} ${s - i * c},${n.y + l} ${s},${n.y}`;
		x.push({
			source: e.source,
			target: e.target,
			kind: e.kind,
			d: u,
			back: r
		});
	}
	return {
		automationId: t,
		width: 168 + Math.max(0, ...s.values()) * 150,
		height: _ + (g + ee) * 120 + ft,
		nodes: y,
		edges: x
	};
}
// src/views/shared.ts
function U(e, t, n) {
	e.dispatchEvent(new CustomEvent(t, {
		detail: n,
		bubbles: !0,
		composed: !0
	}));
}
function ht(e) {
	return P`
    <div class="demo-banner" role="note">
      ${W("mdi:flask-outline")}
      <span class="demo-tag">${e.demoTitle}</span>
      <span class="demo-text">${e.demoText}</span>
    </div>
  `;
}
function gt(e) {
	return {
		draft: "mdi:pencil-outline",
		checked: "mdi:shield-check-outline",
		failed: "mdi:alert-circle-outline",
		applied: "mdi:check-circle-outline",
		reverted: "mdi:undo-variant",
		discarded: "mdi:close-circle-outline"
	}[e] ?? "mdi:circle-outline";
}
function _t(e) {
	return e === "error" ? "mdi:alert-circle" : e === "warning" ? "mdi:alert" : "mdi:information";
}
function vt(e, t) {
	return P`<span class="badge ${t}">${W(gt(t))}${Ke(e, t)}</span>`;
}
function yt(e, t) {
	return {
		busy: e.errBusy,
		model_error: e.errModel,
		invalid_model: e.errInvalidModel,
		not_loaded: e.errNotLoaded,
		apply_blocked: e.errApplyBlocked,
		apply_failed: e.errApplyFailed,
		revert_refused: e.errRevertRefused,
		wrong_state: e.errWrongState,
		not_found: e.errNotFound
	}[t] ?? e.errUnknown;
}
function bt(e, t) {
	return P`
    <div class="alert error" role="alert">
      ${W("mdi:alert-circle")}
      <div class="alert-body">
        <p>${yt(e, t.code)}</p>
        <p class="detail">${t.message}</p>
        <p class="detail code">${e.errorCode}: ${t.code}</p>
      </div>
    </div>
  `;
}
function W(e) {
	return P`<ha-icon icon=${e}></ha-icon>`;
}
var xt = o`
  :host {
    display: block;
    color: var(--primary-text-color);
    font-size: 14px;
    line-height: 1.5;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.3;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 500;
  }
  p {
    margin: 0 0 8px;
  }
  .muted {
    color: var(--secondary-text-color);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  ha-icon {
    --mdc-icon-size: 20px;
    flex: none;
  }
  /* Example data banner: one quiet line, still clearly marked. */
  .demo-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin-bottom: 16px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--secondary-text-color);
    border: 1px dashed var(--warning-color, var(--divider-color));
    border-radius: 8px;
  }
  .demo-banner ha-icon {
    --mdc-icon-size: 18px;
    color: var(--warning-color, var(--secondary-text-color));
  }
  .demo-tag {
    padding: 0 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.7;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--primary-text-color);
    background-color: color-mix(in srgb, var(--warning-color, var(--primary-color)) 22%, transparent);
    border: 1px solid var(--warning-color, var(--primary-color));
    border-radius: 10px;
  }
  .demo-text {
    flex: 1 1 260px;
  }
  .card {
    margin-bottom: 16px;
    padding: 20px;
    background-color: var(--ha-card-background, var(--card-background-color));
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color));
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, none);
  }
  @media (max-width: 480px) {
    .card {
      padding: 16px;
    }
  }
  /* Alert rows: icon and colour by kind, the kind is also written out. */
  .alert {
    --alert-color: var(--info-color, var(--primary-color));
    display: flex;
    gap: 12px;
    margin: 12px 0 0;
    padding: 12px 16px;
    color: var(--primary-text-color);
    background-color: color-mix(in srgb, var(--alert-color) 12%, var(--card-background-color, transparent));
    border: 1px solid color-mix(in srgb, var(--alert-color) 45%, transparent);
    border-inline-start: 4px solid var(--alert-color);
    border-radius: 8px;
  }
  .alert > ha-icon {
    margin-top: 1px;
    color: var(--alert-color);
  }
  .alert.error {
    --alert-color: var(--error-color);
  }
  .alert.warning {
    --alert-color: var(--warning-color);
  }
  .alert.success {
    --alert-color: var(--success-color, var(--primary-color));
  }
  .alert-body {
    flex: 1;
    min-width: 0;
  }
  .alert-body p:last-child {
    margin-bottom: 0;
  }
  .alert .detail {
    margin-bottom: 4px;
    color: var(--secondary-text-color);
    font-family: var(--code-font-family, monospace);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .alert button {
    margin-top: 4px;
  }
  /* Status badge: tinted pill, coloured icon, text in the normal text colour. */
  .badge {
    --badge-color: var(--secondary-text-color);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px 2px 6px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    white-space: nowrap;
    color: var(--primary-text-color);
    background-color: color-mix(in srgb, var(--badge-color) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
    border-radius: 999px;
  }
  .badge ha-icon {
    --mdc-icon-size: 16px;
    color: var(--badge-color);
  }
  .badge.checked,
  .badge.proposal {
    --badge-color: var(--primary-color);
  }
  .badge.applied {
    --badge-color: var(--success-color, var(--primary-color));
  }
  .badge.failed,
  .badge.error {
    --badge-color: var(--error-color);
  }
  .badge.draft,
  .badge.warning {
    --badge-color: var(--warning-color);
  }
  .badge.info {
    --badge-color: var(--info-color, var(--primary-color));
  }
  /* Buttons: native-looking pills. Primary is filled, secondary outlined. */
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    box-sizing: border-box;
    padding: 0 20px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    color: var(--text-primary-color);
    /* Darkened a little so the label keeps its contrast on bright primary colours. */
    background-color: color-mix(in srgb, var(--primary-color) 74%, black);
    border: 1px solid color-mix(in srgb, var(--primary-color) 74%, black);
    border-radius: var(--ha-button-border-radius, 999px);
  }
  button:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  button.secondary,
  button.danger {
    color: var(--primary-text-color);
    background-color: transparent;
    border-color: var(--outline-color, var(--divider-color));
  }
  button.secondary:hover:not(:disabled),
  button.danger:hover:not(:disabled) {
    filter: none;
    background-color: var(--secondary-background-color);
  }
  button.secondary ha-icon {
    color: var(--primary-color);
  }
  button.danger {
    color: var(--error-color);
    border-color: var(--error-color);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  button:focus-visible,
  textarea:focus-visible,
  select:focus-visible,
  summary:focus-visible,
  a:focus-visible,
  pre:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* Segmented control for switching between two representations. */
  .segmented {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    background-color: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 999px;
  }
  .segmented button {
    min-height: 32px;
    padding: 0 16px;
    color: var(--secondary-text-color);
    background: transparent;
    border-color: transparent;
    border-radius: 999px;
  }
  .segmented button.on {
    color: var(--primary-text-color);
    background-color: var(--card-background-color);
    border-color: var(--divider-color);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .segmented button:hover:not(:disabled) {
    filter: none;
    color: var(--primary-text-color);
  }
  dl.facts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 0;
  }
  dl.facts dt {
    color: var(--secondary-text-color);
  }
  dl.facts dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  @media (max-width: 480px) {
    dl.facts {
      grid-template-columns: 1fr;
      gap: 0;
    }
    dl.facts dd {
      margin-bottom: 8px;
    }
  }
`, St = class extends B {
	constructor(...e) {
		super(...e), this._layout = null, this._layoutKey = [];
	}
	static {
		this.properties = {
			t: { attribute: !1 },
			language: { attribute: !1 },
			house: { attribute: !1 },
			net: { attribute: !1 },
			automations: { attribute: !1 },
			marks: { attribute: !1 },
			focusId: { attribute: !1 },
			mode: { attribute: !1 }
		};
	}
	willUpdate() {
		let e = [
			this.house,
			this.automations,
			this.t
		];
		(!this._layout || e.some((e, t) => e !== this._layoutKey[t])) && (this._layoutKey = e, this._layout = ut(this.house, this.automations.map((e) => e.info), (e) => this._alias(e), (e) => this.automations.flatMap((e) => e.info.triggers).find((t) => t.transitionId === e)?.label ?? ""));
	}
	_alias(e) {
		return this.automations.find((t) => t.info.id === e)?.alias ?? e;
	}
	get _hasMarks() {
		let e = this.marks;
		return e.entityIds.size + e.automationIds.size + e.placeIds.size + e.transitionIds.size > 0;
	}
	render() {
		let e = this.t;
		return P`
      ${ht(e)}
      <div class="toolbar">
        <div class="segmented" role="group" aria-label=${e.viewMode}>
          ${["house", "net"].map((t) => P`<button
              type="button"
              class=${this.mode === t ? "on" : ""}
              aria-pressed=${this.mode === t ? "true" : "false"}
              @click=${() => U(this, "set-mode", { mode: t })}
            >
              ${t === "house" ? e.viewHouse : e.viewNet}
            </button>`)}
        </div>
        ${this._hasMarks ? L : P`<button type="button" class="secondary" @click=${() => U(this, "mark-example")}>
              ${e.markExample}
            </button>`}
        ${this._hasMarks ? P`<span class="chip marked">
              ${e.marksActive}
              <button type="button" class="link" @click=${() => U(this, "clear-marks")}>
                ${e.clear}
              </button>
            </span>` : L}
        ${this.focusId ? P`<span class="chip">
              ${e.focusActive(this._alias(this.focusId))}
              <button type="button" class="link" @click=${() => U(this, "clear-focus")}>
                ${e.clear}
              </button>
            </span>` : L}
      </div>
      ${this.mode === "house" ? this._renderHouse() : this._renderNet()}
    `;
	}
	_renderHouse() {
		let e = this.t, t = this._layout;
		if (!t) return L;
		let n = this.focusId, r = new Set(t.edges.filter((e) => e.automationId === n).map((e) => e.tileKey)), i = new Set(this.automations.filter((e) => e.isProposal).map((e) => e.info.id)), a = (e) => n !== null && e !== n;
		return P`
      <div class="scroll">
        <svg
          class="diagram house"
          viewBox="0 0 ${t.width} ${t.height}"
          style="width:100%;min-width:${Math.round(t.width * .7)}px;max-width:${t.width}px"
          role="img"
          aria-label=${e.houseLabel}
        >
          ${this._markers()}
          ${t.rooms.map((t) => F`
              <g class="room">
                <rect x=${t.x} y=${t.y} width=${t.w} height=${t.h} rx="12"></rect>
                <text class="room-name" x=${t.x + 14} y=${t.y + 23}>${t.name ?? e.noRoom}</text>
              </g>`)}
          ${t.edges.map((e) => F`
              <path
                class="edge ${e.kind} ${i.has(e.automationId) ? "proposal" : ""} ${a(e.automationId) ? "dim" : ""}"
                d=${e.d}
                marker-end=${e.kind === "condition" ? "url(#m-cond)" : "url(#m-arrow)"}
              ></path>`)}
          ${t.tiles.map((e) => {
			let t = e.entityId !== null && this.marks.entityIds.has(e.entityId), i = n !== null && !r.has(e.key);
			return F`
              <g class="tile ${t ? "marked" : ""} ${i ? "dim" : ""}">
                ${t ? F`<rect class="halo" x=${e.x - 4} y=${e.y - 4} width=${164} height=${60} rx="12"></rect>` : L}
                <rect class="tile-box" x=${e.x} y=${e.y} width=${156} height=${52} rx="8"></rect>
                <foreignObject x=${e.x + 8} y=${e.y + 12} width="28" height="28">
                  <div class="icon-wrap"><ha-icon icon=${e.icon}></ha-icon></div>
                </foreignObject>
                <text class="tile-name" x=${e.x + 42} y=${e.state ? e.y + 22 : e.y + 31}>${Ct(e.name, 18)}</text>
                ${e.state ? F`<text class="tile-state" x=${e.x + 42} y=${e.y + 40}>${qe(this.language, e.state)}</text>` : L}
              </g>`;
		})}
          ${t.hubs.map((t) => {
			let r = this.automations.find((e) => e.info.id === t.automationId)?.isProposal ?? !1, i = this.marks.automationIds.has(t.automationId), o = t.y + (46 - t.lines.length * 15) / 2 + 11;
			return F`
              <g
                class="hub ${r ? "proposal" : ""} ${i ? "marked" : ""} ${a(t.automationId) ? "dim" : ""} ${n === t.automationId ? "focused" : ""}"
                tabindex="0"
                role="button"
                aria-label=${this._alias(t.automationId)}
                @click=${() => U(this, "focus-automation", {
				automationId: t.automationId,
				toggle: !0
			})}
                @keydown=${(e) => {
				(e.key === "Enter" || e.key === " ") && (e.preventDefault(), U(this, "focus-automation", {
					automationId: t.automationId,
					toggle: !0
				}));
			}}
              >
                ${i ? F`<rect class="halo" x=${t.x - 4} y=${t.y - 4} width=${148} height=${54} rx="14"></rect>` : L}
                <rect class="hub-box" x=${t.x} y=${t.y} width=${140} height=${46} rx="12"></rect>
                ${t.lines.map((e, n) => F`<text class="hub-text" x=${t.x + 70} y=${o + n * 15}>${e}</text>`)}
                ${r ? F`<g class="badge-svg">
                      <rect x=${t.x + 140 - 74} y=${t.y - 9} width="70" height="18" rx="9"></rect>
                      <text x=${t.x + 140 - 39} y=${t.y + 4}>${e.proposalBadge}</text>
                    </g>` : L}
              </g>`;
		})}
        </svg>
      </div>
      ${this._legend(!1)}
    `;
	}
	_renderNet() {
		let e = this.t, t = this.automations;
		if (this.focusId) t = t.filter((e) => e.info.id === this.focusId);
		else if (this._hasMarks) {
			let e = (e) => +!this.marks.automationIds.has(e.info.id);
			t = [...t].sort((t, n) => e(t) - e(n));
		}
		return P`
      <h2 class="net-heading">${e.netHeading}</h2>
      <p class="muted">${e.netHint}</p>
      ${t.map((e) => this._renderDiagram(e))} ${this._legend(!0)}
    `;
	}
	_renderDiagram(e) {
		let t = this.t, n = mt(this.net, e.info.id), r = {
			mode: t.annotationMode,
			delay: t.annotationDelay,
			event: t.annotationEvent,
			guard: t.annotationGuard
		}, i = (e) => this.marks.placeIds.has(e) || this.marks.transitionIds.has(e);
		return P`
      <section class="card net-card ${e.isProposal ? "proposal" : ""}">
        <div class="net-head">
          <h3>${e.alias}</h3>
          ${e.isProposal ? P`<span class="badge proposal">${t.proposalBadge}</span>` : L}
        </div>
        <div class="scroll">
          <svg
            class="diagram net"
            viewBox="0 0 ${n.width} ${n.height}"
            style="width:100%;min-width:${Math.round(n.width * .75)}px;max-width:${n.width}px"
            role="img"
            aria-label=${t.netLabel(e.alias)}
          >
            ${this._markers()}
            ${n.edges.map((e) => {
			let t = i(e.source) && i(e.target);
			return F`<path class="arc ${e.kind} ${t ? "marked" : ""}" d=${e.d} marker-end="url(#m-${e.kind})"></path>`;
		})}
            ${n.nodes.map((e) => {
			let t = i(e.id), n = e.y + 40, a = e.annotations.map((e) => `${r[e.type] ?? e.type}: ${e.value}`), o = e.shape === "place" ? F`<circle class="place ${e.kind}" cx=${e.x} cy=${e.y} r=${20}></circle>` : F`<rect class="trans ${e.kind}" x=${e.x - 20} y=${e.y - 20} width=${40} height=${40} rx="3"></rect>`, s = t ? e.shape === "place" ? F`<circle class="halo" cx=${e.x} cy=${e.y} r=${25}></circle>` : F`<rect class="halo" x=${e.x - 20 - 5} y=${e.y - 20 - 5} width=${50} height=${50} rx="6"></rect>` : L;
			return F`
                <g class="node ${t ? "marked" : ""}">
                  ${s}${o}
                  ${e.lines.map((t, r) => F`<text class="node-label" x=${e.x} y=${n + r * 14}>${t}</text>`)}
                  ${a.map((t, r) => F`<text class="node-ann" x=${e.x} y=${n + e.lines.length * 14 + 2 + r * 13}>${t}</text>`)}
                </g>`;
		})}
          </svg>
        </div>
      </section>
    `;
	}
	_markers() {
		return F`
      <defs>
        <marker id="m-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path class="mk-arrow" d="M0,1 L9,5 L0,9 z"></path>
        </marker>
        <marker id="m-cond" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7">
          <circle class="mk-dot" cx="5" cy="5" r="3.5"></circle>
        </marker>
        <marker id="m-consume" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path class="mk-consume" d="M0,1 L9,5 L0,9 z"></path>
        </marker>
        <marker id="m-produce" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path class="mk-produce" d="M0,0.5 L9.5,5 L0,9.5 z"></path>
        </marker>
        <marker id="m-read" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7">
          <circle class="mk-read" cx="5" cy="5" r="3.5"></circle>
        </marker>
      </defs>`;
	}
	_legend(e) {
		let t = this.t, n = (e, t) => F`
      <svg class="sample" width="48" height="16" viewBox="0 0 48 16" aria-hidden="true">
        ${this._markers()}
        <path class=${e} d="M2,8 L44,8" marker-end=${t}></path>
      </svg>`;
		return P`
      <section class="legend" aria-label=${t.legendHeading}>
        <h3>${t.legendHeading}</h3>
        <ul>
          ${e ? P`
                <li>${n("arc read", "url(#m-read)")}${t.legendRead}</li>
                <li>${n("arc consume", "url(#m-consume)")}${t.legendConsume}</li>
                <li>${n("arc produce", "url(#m-produce)")}${t.legendProduce}</li>
                <li>
                  <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <circle class="place state" cx="11" cy="11" r="9"></circle>
                  </svg>
                  ${t.legendPlaceState}
                </li>
                <li>
                  <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <circle class="place control" cx="11" cy="11" r="9"></circle>
                  </svg>
                  ${t.legendPlaceControl}
                </li>
                <li>
                  <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <rect class="trans trigger" x="3" y="3" width="16" height="16" rx="2"></rect>
                  </svg>
                  ${t.trigger}
                </li>
                <li>
                  <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <rect class="trans action" x="3" y="3" width="16" height="16" rx="2"></rect>
                  </svg>
                  ${t.effect}
                </li>
              ` : P`
                <li>${n("edge trigger", "url(#m-arrow)")}${t.trigger} / ${t.effect}</li>
                <li>${n("edge condition", "url(#m-cond)")}${t.legendCondition}</li>
                <li>${n("edge trigger proposal", "url(#m-arrow)")}${t.legendProposal}</li>
              `}
          <li>
            <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <rect class="halo" x="3" y="3" width="16" height="16" rx="4"></rect>
            </svg>
            ${t.legendMarked}
          </li>
        </ul>
      </section>
    `;
	}
	static {
		this.styles = [xt, o`
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin-bottom: 12px;
      }
      .chip {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        padding: 4px 12px;
        font-size: 13px;
        background-color: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 16px;
      }
      .chip.marked {
        border-color: var(--warning-color);
      }
      button.link {
        padding: 0;
        color: var(--primary-color);
        background: none;
        border: none;
        text-decoration: underline;
      }
      .scroll {
        overflow-x: auto;
      }
      svg.diagram {
        display: block;
        height: auto;
        font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      }
      /* House */
      .room rect {
        fill: var(--secondary-background-color);
        stroke: var(--divider-color);
        stroke-width: 1.5;
      }
      .room-name {
        font-size: 14px;
        font-weight: 500;
        fill: var(--primary-text-color);
      }
      .tile-box {
        fill: var(--card-background-color);
        stroke: var(--divider-color);
        stroke-width: 1.5;
      }
      .tile-name {
        font-size: 12px;
        fill: var(--primary-text-color);
      }
      .tile-state {
        font-size: 12px;
        fill: var(--secondary-text-color);
      }
      .icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        color: var(--primary-color);
      }
      .icon-wrap ha-icon {
        --mdc-icon-size: 24px;
      }
      .hub-box {
        fill: var(--card-background-color);
        stroke: var(--secondary-text-color);
        stroke-width: 1.5;
      }
      .hub {
        cursor: pointer;
      }
      .hub:focus-visible .hub-box,
      .hub.focused .hub-box {
        stroke: var(--primary-color);
        stroke-width: 3;
      }
      .hub-text {
        font-size: 13px;
        text-anchor: middle;
        fill: var(--primary-text-color);
        pointer-events: none;
      }
      .hub.proposal .hub-box {
        stroke: var(--primary-color);
        stroke-width: 2.5;
        stroke-dasharray: 6 4;
      }
      .badge-svg rect {
        fill: var(--primary-color);
      }
      .badge-svg text {
        font-size: 11px;
        font-weight: 500;
        text-anchor: middle;
        fill: var(--text-primary-color);
      }
      .edge {
        fill: none;
        stroke: var(--secondary-text-color);
        stroke-width: 1.6;
      }
      .edge.condition {
        stroke-dasharray: 5 4;
      }
      .edge.proposal {
        stroke: var(--primary-color);
        stroke-width: 2.2;
        stroke-dasharray: 6 4;
      }
      .halo {
        fill: none;
        stroke: var(--warning-color);
        stroke-width: 3;
      }
      .dim {
        opacity: 0.22;
      }
      .mk-arrow,
      .mk-dot {
        fill: var(--secondary-text-color);
      }
      .mk-consume {
        fill: var(--secondary-text-color);
      }
      .mk-produce {
        fill: var(--primary-color);
      }
      .mk-read {
        fill: var(--card-background-color);
        stroke: var(--secondary-text-color);
        stroke-width: 1.5;
      }
      /* Net */
      .net-heading {
        margin-top: 4px;
      }
      .net-card.proposal {
        border-color: var(--primary-color);
        border-style: dashed;
      }
      .net-head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      .net-head h3 {
        margin: 0;
      }
      .place {
        fill: var(--card-background-color);
        stroke: var(--primary-text-color);
        stroke-width: 1.8;
      }
      .place.control {
        fill: var(--secondary-background-color);
        stroke-dasharray: 4 3;
      }
      .trans {
        stroke: var(--primary-text-color);
        stroke-width: 1.8;
        fill: var(--card-background-color);
      }
      .trans.action {
        fill: var(--primary-text-color);
      }
      .node-label {
        font-size: 12px;
        text-anchor: middle;
        fill: var(--primary-text-color);
      }
      .node-ann {
        font-size: 11px;
        font-style: italic;
        text-anchor: middle;
        fill: var(--secondary-text-color);
      }
      .arc {
        fill: none;
        stroke: var(--secondary-text-color);
        stroke-width: 1.6;
      }
      .arc.read {
        stroke-dasharray: 5 4;
      }
      .arc.produce {
        stroke: var(--primary-color);
        stroke-width: 2.6;
      }
      .arc.marked {
        stroke: var(--warning-color);
      }
      /* Legend */
      .legend {
        margin-top: 16px;
        padding: 12px 16px;
        background-color: var(--card-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 12px;
        font-size: 13px;
      }
      .legend h3 {
        font-size: 13px;
        color: var(--secondary-text-color);
      }
      .legend ul {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 20px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .legend li {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sample .edge,
      .sample .arc {
        fill: none;
      }
    `];
	}
};
function Ct(e, t) {
	return e.length > t ? `${e.slice(0, t - 1)}…` : e;
}
customElements.define("ai-drafts-domain", St);
// src/views/inventory.ts
var wt = class extends B {
	static {
		this.properties = {
			t: { attribute: !1 },
			items: { attribute: !1 },
			dependencies: { attribute: !1 },
			stateLabelOf: { attribute: !1 }
		};
	}
	render() {
		let e = this.t;
		return P`
      ${ht(e)}
      <h2>${e.inventoryHeading}</h2>
      ${this.items.length === 0 ? P`<p class="muted">${e.inventoryEmpty}</p>` : L}
      <ul class="list">
        ${this.items.map((e) => this._renderItem(e))}
      </ul>
    `;
	}
	_renderItem(e) {
		let t = this.t, n = e.description, r = {
			hour: t.unitHour,
			minute: t.unitMinute,
			second: t.unitSecond
		}, i = (e) => this.items.find((t) => t.id === e)?.alias ?? e, a = (e) => e === "trigger" ? t.roleTrigger : t.roleCondition, o = [...this.dependencies.filter((t) => t.from === e.id).map((e) => t.writesFor(this.stateLabelOf(e.placeId), i(e.to), a(e.role))), ...this.dependencies.filter((t) => t.to === e.id).map((e) => t.readsFrom(this.stateLabelOf(e.placeId), i(e.from), a(e.role)))];
		return P`
      <li class="card">
        <div class="head">
          <h3>${e.alias}</h3>
        </div>
        <p class="summary">
          <span class="part">${n.triggers.map((e) => e.text).join(", ")}</span>
          <span class="arrow" aria-hidden="true">${t.summaryArrow}</span>
          <span class="part"
            >${n.effects.map((e) => e.delay ? `${t.after(rt(e.delay, r))}: ${e.text}` : e.text).join(", ")}</span
          >
        </p>
        <dl class="facts">
          <dt>${t.condition}</dt>
          <dd>${n.conditions.length ? n.conditions.map((e) => e.text).join(", ") : t.none}</dd>
          <dt>${n.rooms.length === 1 ? t.room : t.rooms}</dt>
          <dd>${n.rooms.length ? n.rooms.join(", ") : t.none}</dd>
          ${e.mode ? P`<dt>${t.modeLabel}</dt><dd>${e.mode}</dd>` : L}
          <dt>${t.dependenciesHeading}</dt>
          <dd>
            ${o.length === 0 ? P`<span class="muted">${t.noDependencies}</span>` : o.map((e) => P`<div class="dep">${e}</div>`)}
          </dd>
        </dl>
        <div class="actions">
          <button
            type="button"
            class="secondary"
            @click=${() => U(this, "focus-automation", { automationId: e.id })}
          >
            ${t.showInDomainView}
          </button>
        </div>
      </li>
    `;
	}
	static {
		this.styles = [xt, o`
      .list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
      }
      .head h3 {
        margin: 0;
        font-size: 16px;
      }
      .summary {
        margin: 0 0 12px;
        font-size: 15px;
      }
      .arrow {
        margin: 0 6px;
        color: var(--primary-color);
        font-weight: 500;
      }
      .facts {
        margin-bottom: 12px;
        font-size: 14px;
      }
      .actions {
        margin-top: 12px;
      }
      .dep + .dep {
        margin-top: 4px;
      }
    `];
	}
};
customElements.define("ai-drafts-inventory", wt);
// src/logic/changeset-actions.ts
var Tt = {
	draft: ["discard"],
	checked: ["apply", "discard"],
	failed: ["discard"],
	applied: ["revert"],
	reverted: [],
	discarded: []
};
function Et(e) {
	return Tt[e];
}
// src/logic/yaml.ts
var Dt = /^[\p{L}_][\p{L}\p{N}_ ./-]*$/u, Ot = /^(true|false|yes|no|on|off|y|n|null|~)$/i;
function kt(e) {
	return e === null ? "null" : typeof e == "string" ? Dt.test(e) && !Ot.test(e) && !e.endsWith(" ") ? e : JSON.stringify(e) : String(e);
}
function At(e) {
	return typeof e != "object" || !e;
}
function jt(e) {
	return typeof e == "object" && !!e && (Array.isArray(e) ? e.length === 0 : Object.keys(e).length === 0);
}
function Mt(e) {
	return Array.isArray(e) ? "[]" : typeof e == "object" && e ? "{}" : kt(e);
}
function Nt(e, t) {
	let n = [];
	if (Array.isArray(e)) for (let r of e) if (At(r) || jt(r)) n.push(`${t}- ${Mt(r)}`);
	else {
		let [e, ...i] = Nt(r, `${t}  `);
		n.push(`${t}- ${e.slice(t.length + 2)}`, ...i);
	}
	else if (typeof e == "object" && e) for (let [r, i] of Object.entries(e)) At(i) || jt(i) ? n.push(`${t}${kt(r)}: ${Mt(i)}`) : n.push(`${t}${kt(r)}:`, ...Nt(i, `${t}  `));
	return n;
}
function G(e) {
	return At(e) || jt(e) ? Mt(e) : Nt(e, "").join("\n");
}
// src/logic/describe-config.ts
var K = (e) => typeof e == "object" && !!e && !Array.isArray(e), Pt = /^[a-z0-9_]+\.[a-z0-9_]+$/, Ft = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/, It = ["id", "alias"];
function q(e) {
	return e == null ? [] : Array.isArray(e) ? e : [e];
}
function J(e) {
	let t = q(e);
	return t.length === 0 || !t.every((e) => typeof e == "string") ? null : t;
}
function Lt(e, t) {
	return e.quote(t);
}
function Y(e, t, n) {
	return new Intl.ListFormat(e.language, {
		style: "long",
		type: n
	}).format(t);
}
function Rt(e) {
	return {
		hour: e.unitHour,
		minute: e.unitMinute,
		second: e.unitSecond
	};
}
function zt(e, t) {
	return typeof t == "boolean" ? Lt(e.t, qe(e.language, t ? "on" : "off")) : typeof t == "string" || typeof t == "number" ? Lt(e.t, qe(e.language, String(t))) : null;
}
function Bt(e, t) {
	let n = q(t).map((t) => zt(e, t));
	return n.length === 0 || n.some((e) => e === null) ? null : Y(e, n, "disjunction");
}
function X(e, t) {
	let n = Rt(e.t);
	if (typeof t == "string") {
		let e = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(t);
		return e ? rt(`${e[1]}:${e[2]}:${e[3] ?? "00"}`, n) : null;
	}
	if (typeof t == "number") {
		if (!Number.isFinite(t) || t < 0) return null;
		let e = Math.round(t), r = Math.floor(e / 3600), i = Math.floor(e % 3600 / 60), a = e % 60;
		return rt(`${r}:${String(i).padStart(2, "0")}:${String(a).padStart(2, "0")}`, n);
	}
	if (K(t)) {
		let n = [
			"days",
			"hours",
			"minutes",
			"seconds",
			"milliseconds"
		];
		if (!Object.keys(t).every((e) => n.includes(e)) || !Object.values(t).every((e) => typeof e == "number")) return null;
		let r = (e) => Number(t[e] ?? 0);
		return r("milliseconds") === 0 ? X(e, r("days") * 86400 + r("hours") * 3600 + r("minutes") * 60 + r("seconds")) : null;
	}
	return null;
}
function Vt(e, t) {
	if (typeof t != "string") return null;
	let n = Ft.exec(t);
	if (n) {
		let e = n[1].padStart(2, "0");
		return { clock: n[3] && n[3] !== "00" ? `${e}:${n[2]}:${n[3]}` : `${e}:${n[2]}` };
	}
	return Pt.test(t) ? { entity: e.nameOf(t) } : null;
}
function Ht(e, t) {
	if (t === void 0) return {
		text: "",
		before: !1
	};
	let n = !1, r = t;
	typeof t == "string" && t.startsWith("-") ? (n = !0, r = t.slice(1)) : typeof t == "string" && t.startsWith("+") ? r = t.slice(1) : typeof t == "number" && t < 0 && (n = !0, r = -t);
	let i = X(e, r);
	return i === null ? null : {
		text: i,
		before: n
	};
}
function Ut(e, t) {
	return t === "sunrise" ? e.t.sunrise : t === "sunset" ? e.t.sunset : null;
}
function Wt(e, t) {
	return typeof t == "number" ? String(t) : typeof t == "string" && Pt.test(t) ? e.nameOf(t) : typeof t == "string" && t.trim() !== "" && Number.isFinite(Number(t)) ? t.trim() : null;
}
function Gt(e, t, n) {
	return Y(e, t.map((t) => e.nameOf(t)), n);
}
function Kt(e, ...t) {
	for (let n of t) if (typeof e[n] == "string") return e[n];
	return null;
}
function Z(e, t) {
	return Object.keys(e).every((e) => t.includes(e) || It.includes(e));
}
function Q(e, t, n) {
	return {
		text: e,
		fragments: [{
			label: n,
			yaml: G(t)
		}]
	};
}
function qt(e, t) {
	let n = t.t, r = (t) => Q(t ? n.unknownTriggerOf(t) : n.unknownTrigger, e, n.fragmentYaml);
	if (!K(e)) return r(null);
	let i = Kt(e, "trigger", "platform"), a = (e) => ({
		text: e,
		fragments: []
	}), o = () => {
		if (e.for === void 0) return "";
		let r = X(t, e.for);
		return r === null ? void 0 : n.triggerFor(r);
	};
	switch (i) {
		case "state": {
			if (!Z(e, [
				"trigger",
				"platform",
				"entity_id",
				"to",
				"from",
				"for"
			])) break;
			let r = J(e.entity_id), i = o();
			if (!r || i === void 0) break;
			let s = Gt(t, r, "disjunction"), c = e.to === void 0 || e.to === null ? null : Bt(t, e.to), l = e.from === void 0 || e.from === null ? null : Bt(t, e.from);
			if (e.to !== void 0 && e.to !== null && c === null || e.from !== void 0 && e.from !== null && l === null) break;
			return a(c && l ? n.changesFromTo(s, l, c) + i : c ? n.changesTo(s, c) + i : l ? n.changesFrom(s, l) + i : n.changes(s) + i);
		}
		case "time": {
			if (!Z(e, [
				"trigger",
				"platform",
				"at"
			])) break;
			let r = q(e.at).map((e) => Vt(t, e));
			if (r.length === 0 || r.some((e) => e === null)) break;
			return a(Y(t, r.map((e) => "clock" in e ? n.timeAt(n.clock(e.clock)) : n.timeAtEntity(e.entity)), "disjunction"));
		}
		case "sun": {
			if (!Z(e, [
				"trigger",
				"platform",
				"event",
				"offset"
			])) break;
			let r = Ut(t, e.event), i = Ht(t, e.offset);
			if (!r || !i) break;
			return a(n.sunTrigger(r, i.text, i.before));
		}
		case "numeric_state": {
			if (!Z(e, [
				"trigger",
				"platform",
				"entity_id",
				"above",
				"below",
				"for"
			])) break;
			let r = J(e.entity_id), i = o(), s = e.above === void 0 ? null : Wt(t, e.above), c = e.below === void 0 ? null : Wt(t, e.below);
			if (!r || i === void 0 || e.above !== void 0 && s === null || e.below !== void 0 && c === null || s === null && c === null) break;
			return a(n.triggerNumeric(Gt(t, r, "disjunction"), s, c) + i);
		}
	}
	return r(i);
}
function Jt(e, t) {
	let n = t.t, r = (t) => Q(t ? n.unknownConditionOf(t) : n.unknownCondition, e, n.fragmentYaml);
	if (!K(e)) return r(null);
	let i = Kt(e, "condition"), a = (e) => ({
		text: e,
		fragments: []
	});
	switch (i) {
		case "state": {
			if (!Z(e, [
				"condition",
				"entity_id",
				"state",
				"for"
			])) break;
			let r = J(e.entity_id), i = Bt(t, e.state), o = "";
			if (e.for !== void 0) {
				let r = X(t, e.for);
				if (r === null) break;
				o = n.conditionFor(r);
			}
			if (!r || !i) break;
			return a(n.isState(Gt(t, r, "conjunction"), i) + o);
		}
		case "numeric_state": {
			if (!Z(e, [
				"condition",
				"entity_id",
				"above",
				"below"
			])) break;
			let r = J(e.entity_id), i = e.above === void 0 ? null : Wt(t, e.above), o = e.below === void 0 ? null : Wt(t, e.below);
			if (!r || e.above !== void 0 && i === null || e.below !== void 0 && o === null || i === null && o === null) break;
			return a(n.conditionNumeric(Gt(t, r, "conjunction"), i, o));
		}
		case "sun": {
			if (!Z(e, [
				"condition",
				"after",
				"before",
				"after_offset",
				"before_offset"
			])) break;
			let o = [];
			for (let [a, s] of [["after", "after"], ["before", "before"]]) {
				if (e[a] === void 0) continue;
				let c = Ut(t, e[a]), l = Ht(t, e[`${a}_offset`]);
				if (!c || !l) return r(i);
				o.push(n.sunCondition(s, c, l.text, l.before));
			}
			if (o.length === 0) break;
			return a(Y(t, o, "conjunction"));
		}
		case "time": {
			if (!Z(e, [
				"condition",
				"after",
				"before",
				"weekday"
			])) break;
			let r = [], i = !1;
			for (let a of ["after", "before"]) {
				if (e[a] === void 0) continue;
				let o = Vt(t, e[a]);
				o === null ? i = !0 : r.push("clock" in o ? n.timeCondition(a, n.clock(o.clock)) : n.timeConditionEntity(a, o.entity));
			}
			if (i) break;
			if (e.weekday !== void 0) {
				let i = J(e.weekday), a = [
					"mon",
					"tue",
					"wed",
					"thu",
					"fri",
					"sat",
					"sun"
				];
				if (!i || !i.every((e) => a.includes(e))) break;
				let o = new Intl.DateTimeFormat(t.language, {
					weekday: "short",
					timeZone: "UTC"
				});
				r.push(n.onWeekdays(Y(t, a.filter((e) => i.includes(e)).map((e) => o.format(new Date(Date.UTC(2024, 0, 1 + a.indexOf(e))))), "conjunction")));
			}
			if (r.length === 0) break;
			return a(Y(t, r, "conjunction"));
		}
	}
	return r(i);
}
function Yt(e) {
	let t = {}, n = [], r = (e) => {
		if (K(e)) for (let [r, i] of Object.entries(e)) {
			let e = r === "entity_id" ? J(i) : null;
			e && e.every((e) => Pt.test(e)) ? n.push(...e) : t[r] = i;
		}
	};
	return r(e.target), e.entity_id !== void 0 && r({ entity_id: e.entity_id }), {
		ids: n,
		rest: t
	};
}
function Xt(e, t) {
	let n = t.t;
	if (!K(e)) return Q(n.unknownAction, e, n.fragmentYaml);
	let r = Kt(e, "action", "service");
	if (r !== null && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(r)) {
		let i = [
			"action",
			"service",
			"target",
			"entity_id",
			"data",
			"metadata",
			"alias",
			"id"
		];
		if (Object.keys(e).filter((e) => !i.includes(e)).length === 0) {
			let { ids: i, rest: a } = Yt(e), o = i.length > 0 ? Y(t, i.map((e) => t.nameOf(e)), "conjunction") : null, s = r.split(".")[1], c;
			c = o && s === "turn_on" ? n.turnOn(o) : o && s === "turn_off" ? n.turnOff(o) : o && s === "toggle" ? n.toggle(o) : o ? n.callOn(r, o) : n.call(r);
			let l = [];
			return Object.keys(a).length > 0 && l.push({
				label: n.fragmentTarget,
				yaml: G(a)
			}), (K(e.data) && Object.keys(e.data).length > 0 || e.data !== void 0 && !K(e.data)) && l.push({
				label: n.fragmentData,
				yaml: G(e.data)
			}), {
				text: c,
				fragments: l
			};
		}
		return Q(n.unknownActionOf(r), e, n.fragmentYaml);
	}
	if ("delay" in e && Z(e, ["delay"])) {
		let r = X(t, e.delay);
		return r === null ? Q(n.unknownActionOf("delay"), e, n.fragmentYaml) : {
			text: n.waits(r),
			fragments: []
		};
	}
	let i = Object.keys(e).find((e) => !It.includes(e)) ?? null;
	return Q(i ? n.unknownActionOf(i) : n.unknownAction, e, n.fragmentYaml);
}
function Zt(e) {
	return {
		...e,
		text: e.text.charAt(0).toUpperCase() + e.text.slice(1)
	};
}
var Qt = [
	"id",
	"alias",
	"description",
	"mode",
	"max",
	"triggers",
	"trigger",
	"conditions",
	"condition",
	"actions",
	"action"
];
function $t(e, t) {
	let n = (t, n) => e[t] === void 0 ? e[n] : e[t], r = (e) => typeof e == "string" && e ? e : null, i = Object.entries(e).filter(([e]) => !Qt.includes(e)).map(([e, t]) => ({
		label: e,
		yaml: G({ [e]: t })
	}));
	return {
		alias: r(e.alias),
		description: r(e.description),
		mode: r(e.mode),
		triggers: q(n("triggers", "trigger")).map((e) => Zt(qt(e, t))),
		conditions: q(n("conditions", "condition")).map((e) => Zt(Jt(e, t))),
		actions: q(n("actions", "action")).map((e) => Zt(Xt(e, t))),
		other: i
	};
}
// src/logic/diff.ts
function en(e, t) {
	let n = (e, t) => e === null ? [] : e.split("\n").map((e) => ({
		kind: t,
		text: e
	}));
	return [...n(e, "remove"), ...n(t, "add")];
}
function tn(e) {
	return en(e.before ? G(e.before) : null, e.after ? G(e.after) : null);
}
// src/views/proposal.ts
var nn = ["description", "yaml"], rn = class extends B {
	static {
		this.properties = {
			t: { attribute: !1 },
			language: { attribute: !1 },
			proposal: { attribute: !1 },
			section: { attribute: !1 },
			nameOf: { attribute: !1 },
			pending: { attribute: !1 },
			error: { attribute: !1 },
			_copied: { state: !0 }
		};
	}
	constructor() {
		super(), this._names = [], this._copied = null, this.section = "description", this.pending = null, this.error = null;
	}
	render() {
		let e = this.t, t = this.proposal;
		return t ? P`
      <section class="card">${this._renderHead(t)}${this._renderStatusNote(t)}</section>
      <section class="card">${this._renderBody(t)}</section>
      <section class="card">
        <h2>${e.findingsHeading}${t.findings.length > 0 ? P` <span class="count">${t.findings.length}</span>` : L}</h2>
        ${this._renderFindings(t)}
      </section>
      ${this._renderDecision(t)}
    ` : P`
        <section class="card empty">
          ${W("mdi:file-document-outline")}
          <p class="muted">${e.noProposal}</p>
          <button type="button" class="secondary" @click=${() => U(this, "goto-request")}>
            ${W("mdi:arrow-left")}${e.toRequest}
          </button>
        </section>
      `;
	}
	_renderHead(e) {
		let t = this.t, n = (e) => new Intl.DateTimeFormat(this.language, {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(new Date(e)), r = (e.operations.length === 1 ? e.operations[0] : void 0)?.after?.alias;
		return P`
      <div class="head">
        <h2 class="headline">${typeof r == "string" && r ? r : t.proposalHeading}</h2>
        ${vt(t, e.status)}
      </div>
      <p class="request">${W("mdi:format-quote-open")}<span>${e.request}</span></p>
      <dl class="meta">
        <div><dt>${t.metaModel}</dt><dd>${e.model ?? t.modelUnknown}</dd></div>
        <div><dt>${t.metaRounds}</dt><dd>${e.rounds}</dd></div>
        <div><dt>${t.metaCreated}</dt><dd>${n(e.created)}</dd></div>
        ${e.decided ? P`<div><dt>${t.metaDecided}</dt><dd>${n(e.decided)}</dd></div>` : L}
      </dl>
    `;
	}
	_renderStatusNote(e) {
		let t = this.t, n = e.findings.filter((e) => e.severity === "error").length;
		return e.status === "failed" ? P`<div class="alert error" role="note">
        ${W("mdi:alert-circle")}
        <div class="alert-body">
          <strong>${t.failedTitle}</strong>
          <p>${t.failedText(e.rounds, n)}</p>
        </div>
      </div>` : e.status === "draft" ? P`<div class="alert warning" role="note">
        ${W("mdi:alert")}
        <div class="alert-body"><p>${t.draftNote}</p></div>
      </div>` : L;
	}
	_renderBody(e) {
		let t = this.t, n = {
			description: t.partDescription,
			yaml: t.partYaml
		};
		return P`
      <div class="segmented" role="group" aria-label=${t.partsLabel}>
        ${nn.map((e) => P`<button
            type="button"
            class=${this.section === e ? "on" : ""}
            aria-pressed=${this.section === e ? "true" : "false"}
            @click=${() => U(this, "set-part", { part: e })}
          >
            ${n[e]}
          </button>`)}
      </div>
      ${this.section === "description" ? e.operations.map((t, n) => this._renderDescription(t, n, e.operations.length)) : this._renderYaml(e)}
    `;
	}
	_renderDescription(e, t, n) {
		let r = this.t;
		if (this._names = [], e.kind !== "automation" || e.op !== "create" || !e.after) return P`<div class="op">
        ${this._renderItem({
			text: r.operationOther(e.op, e.kind),
			fragments: [{
				label: r.fragmentYaml,
				yaml: G(e)
			}]
		})}
      </div>`;
		let i = $t(e.after, {
			t: r,
			language: this.language,
			nameOf: (e) => {
				let t = (this.nameOf ?? ((e) => e))(e);
				return this._names.push(t), t;
			}
		});
		return P`<div class="op">
      ${n > 1 ? P`<h3>${this._heading(i, t, n)}</h3>` : L}
      ${i.description ? P`<p class="muted desc">${i.description}</p>` : L}
      <ol class="flow">
        ${this._renderStep("trigger", r.triggersHeading, "mdi:flash-outline", i.triggers)}
        ${this._renderStep("condition", r.conditionsHeading, "mdi:filter-outline", i.conditions)}
        ${this._renderStep("action", r.actionsHeading, "mdi:play-circle-outline", i.actions, !0)}
      </ol>
      ${i.mode ? P`<p class="mode">${W("mdi:repeat")}<span><span class="muted">${r.modeLabel}:</span> ${this._modeText(i.mode)}</span></p>` : L}
      ${i.other.length > 0 ? P`<h4>${r.otherFieldsHeading}</h4>${i.other.map((e) => this._renderFragment(e))}` : L}
    </div>`;
	}
	_heading(e, t, n) {
		let r = this.t, i = e.alias ? r.automationHeading(e.alias) : r.automationUnnamed;
		return n > 1 ? `${t + 1}/${n} ${i}` : i;
	}
	_modeText(e) {
		let t = this.t;
		return e === "restart" ? t.modeRestart : e === "single" ? t.modeSingle : e;
	}
	_renderStep(e, t, n, r, i = !1) {
		let a = this.t;
		return P`
      <li class="step ${e}">
        <span class="rail">${W(n)}</span>
        <div class="step-body">
          <h4>${t}</h4>
          ${r.length === 0 ? P`<p class="muted none">${a.none}</p>` : P`<ul class="items ${i ? "numbered" : ""}">
                ${r.map((e) => P`<li>${this._renderItem(e)}</li>`)}
              </ul>`}
        </div>
      </li>
    `;
	}
	_rich(e) {
		let t = [...new Set(this._names)].filter((e) => e.length > 1).sort((e, t) => t.length - e.length), n = [...t.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "[„“”][^„“”]+[“”]"], r = RegExp(`(${n.join("|")})`, "g");
		return e.split(r).map((e, n) => n % 2 == 0 || e === "" ? e : t.includes(e) ? P`<span class="entity">${e}</span>` : P`<span class="state-value">${e}</span>`);
	}
	_renderItem(e) {
		return P`<span class="item-text">${this._rich(e.text)}</span>${e.fragments.map((e) => this._renderFragment(e))}`;
	}
	_renderFragment(e) {
		return P`<div class="fragment">
      <span class="frag-label">${e.label}</span>
      <pre class="yaml">${e.yaml}</pre>
    </div>`;
	}
	_renderYaml(e) {
		let t = this.t;
		return P`
      <p class="muted note">${t.yamlNote}</p>
      ${e.operations.map((e, n) => {
			let r = tn(e), i = this._copied === n;
			return P`<div class="code">
          <div class="code-bar">
            <span class="code-label">${W("mdi:code-braces")}${t.partYaml}</span>
            <button type="button" class="secondary small" @click=${() => void this._copy(r, n)}>
              ${W(i ? "mdi:check" : "mdi:content-copy")}${i ? t.copiedYaml : t.copyYaml}
            </button>
          </div>
          <pre class="yaml diff" tabindex="0">${r.map((e) => this._renderLine(e))}</pre>
        </div>`;
		})}
      <span class="visually-hidden" role="status">${this._copied === null ? "" : t.copiedYaml}</span>
    `;
	}
	async _copy(e, t) {
		try {
			await navigator.clipboard.writeText(e.map((e) => e.text).join("\n"));
		} catch {
			return;
		}
		this._copied = t, clearTimeout(this._copyTimer), this._copyTimer = setTimeout(() => this._copied = null, 2e3);
	}
	disconnectedCallback() {
		clearTimeout(this._copyTimer), super.disconnectedCallback();
	}
	_renderLine(e) {
		return P`<span class="dl ${e.kind}">${e.text}</span>`;
	}
	_renderFindings(e) {
		let t = this.t;
		return e.findings.length === 0 ? e.status === "draft" || e.status === "failed" ? P`<p class="muted">${t.noFindings}</p>` : P`<div class="alert success no-findings" role="status">
        ${W("mdi:check-circle")}
        <div class="alert-body">
          <strong>${t.noFindings}</strong>
          <p>${t.noFindingsDetail}</p>
        </div>
      </div>` : P`<ul class="findings">
      ${e.findings.map((e) => this._renderFinding(e))}
    </ul>`;
	}
	_renderFinding(e) {
		let t = this.t, n = e.severity === "error" ? t.severityError : e.severity === "warning" ? t.severityWarning : t.severityInfo;
		return P`
      <li class="alert ${e.severity === "error" ? "error" : e.severity === "warning" ? "warning" : "info"} finding">
        ${W(_t(e.severity))}
        <div class="alert-body">
          <div class="line">
            <strong class="severity">${n}</strong>
            <code class="check">${e.check}</code>
          </div>
          <p>${e.message}</p>
          ${e.path ? P`<p class="path muted">${t.pathLabel}: <code>${e.path}</code></p>` : L}
          ${e.net_refs.length > 0 ? P`<button
                type="button"
                class="secondary small"
                @click=${() => U(this, "show-finding", { netRefs: e.net_refs })}
              >
                ${W("mdi:graph-outline")}${t.showInDomain}
              </button>` : L}
        </div>
      </li>
    `;
	}
	_renderDecision(e) {
		let t = this.t, n = Et(e.status), r = this.pending !== null, i = {
			apply: [t.apply, t.applying],
			discard: [t.discard, t.discarding],
			revert: [t.revert, t.reverting]
		}, a = {
			apply: "",
			discard: "danger",
			revert: "secondary"
		}, o = {
			apply: "mdi:check",
			discard: "mdi:delete-outline",
			revert: "mdi:undo-variant"
		}, s = e.operations.flatMap((e) => e.target_id ? [e.target_id] : []), c = {
			applied: t.stateApplied,
			reverted: t.stateReverted,
			discarded: t.stateDiscarded
		}, l = n.length > 0 || e.status === "reverted" || e.status === "discarded";
		return P`
      <section class="card decision ${n.includes("apply") ? "sticky" : ""}">
        <h2 class="visually-hidden">${t.decisionHeading}</h2>
        ${c[e.status] ? P`<p class="state" role="status">${W("mdi:information-outline")}<span>${c[e.status]}</span></p>` : L}
        ${e.status === "applied" && s.length > 0 ? P`<ul class="created">
              ${s.map((e) => P`<li>
                  <span class="muted">${t.createdAutomation} (${t.automationId}):</span>
                  <code>${e}</code>
                  <a href="/config/automation/edit/${encodeURIComponent(e)}">${t.openInEditor}</a>
                </li>`)}
            </ul>` : L}
        ${l ? P`<div class="decide">
              <div class="actions">
                ${n.map((e) => P`<button
                    type="button"
                    class="${a[e]} ${e === "apply" ? "primary-action" : ""}"
                    ?disabled=${r}
                    aria-busy=${this.pending === e ? "true" : "false"}
                    @click=${() => U(this, "decide", { decision: e })}
                  >
                    ${W(o[e])}${this.pending === e ? i[e][1] : i[e][0]}
                  </button>`)}
                ${e.status === "reverted" || e.status === "discarded" ? P`<button type="button" class="secondary" @click=${() => U(this, "goto-request")}>
                      ${W("mdi:arrow-left")}${t.toRequest}
                    </button>` : L}
              </div>
              ${n.includes("apply") ? P`<p class="effect muted">${t.applyEffect}</p>` : L}
              ${n.includes("revert") ? P`<p class="effect muted">${t.revertEffect}</p>` : L}
            </div>` : L}
        ${this.error ? bt(t, this.error) : L}
      </section>
    `;
	}
	static {
		this.styles = [xt, o`
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding-block: 32px;
        text-align: center;
      }
      .empty ha-icon {
        --mdc-icon-size: 40px;
        color: var(--secondary-text-color);
      }
      .empty p {
        margin: 0;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px 12px;
      }
      .headline {
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
        font-size: 22px;
        font-weight: 500;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }
      .request {
        display: flex;
        gap: 6px;
        margin: 8px 0 14px;
        color: var(--secondary-text-color);
        overflow-wrap: anywhere;
      }
      .request ha-icon {
        --mdc-icon-size: 18px;
        margin-top: 2px;
      }
      dl.meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 24px;
        margin: 0;
        font-size: 13px;
      }
      dl.meta div {
        display: flex;
        gap: 6px;
      }
      dl.meta dt {
        color: var(--secondary-text-color);
      }
      dl.meta dd {
        margin: 0;
      }
      .alert {
        margin-top: 16px;
      }
      .count {
        display: inline-block;
        min-width: 20px;
        padding: 0 6px;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
        text-align: center;
        vertical-align: 2px;
        background-color: var(--secondary-background-color);
        border-radius: 10px;
      }
      .segmented {
        margin-bottom: 20px;
      }
      h4 {
        margin: 0 0 4px;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }
      .op + .op {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--divider-color);
      }
      .op h3 {
        margin: 0 0 4px;
      }
      .desc {
        margin: 0 0 16px;
      }
      /* The flow: trigger, conditions, actions, connected by a line. */
      .flow {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .step {
        position: relative;
        display: flex;
        gap: 14px;
        padding-bottom: 20px;
      }
      .step:last-child {
        padding-bottom: 0;
      }
      .step:not(:last-child)::before {
        position: absolute;
        top: 36px;
        bottom: 4px;
        left: 17px;
        width: 2px;
        content: "";
        background-color: var(--divider-color);
      }
      .rail {
        display: grid;
        flex: none;
        place-items: center;
        width: 36px;
        height: 36px;
        color: var(--primary-color);
        background-color: color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color));
        border: 1px solid color-mix(in srgb, var(--primary-color) 40%, transparent);
        border-radius: 50%;
      }
      .step-body {
        flex: 1;
        min-width: 0;
        padding-top: 6px;
      }
      .items {
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 15px;
      }
      .items li + li {
        margin-top: 8px;
      }
      .items.numbered {
        counter-reset: n;
      }
      .items.numbered li {
        position: relative;
        padding-inline-start: 28px;
        counter-increment: n;
      }
      .items.numbered li::before {
        position: absolute;
        top: 2px;
        left: 0;
        width: 20px;
        height: 20px;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
        text-align: center;
        content: counter(n);
        color: var(--secondary-text-color);
        border: 1px solid var(--divider-color);
        border-radius: 50%;
      }
      .item-text {
        overflow-wrap: anywhere;
      }
      .entity {
        display: inline-block;
        padding: 0 8px;
        font-weight: 500;
        line-height: 1.55;
        background-color: color-mix(in srgb, var(--primary-color) 14%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-color) 35%, transparent);
        border-radius: 6px;
      }
      .state-value {
        font-weight: 500;
      }
      .none {
        margin: 0;
      }
      .mode {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 20px 0 0;
        padding-top: 14px;
        font-size: 13px;
        border-top: 1px solid var(--divider-color);
      }
      .mode ha-icon {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color);
      }
      .fragment {
        margin: 6px 0;
      }
      .frag-label {
        display: block;
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .findings {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .finding {
        margin: 0 0 8px;
      }
      .finding:last-child {
        margin-bottom: 0;
      }
      .no-findings {
        margin-top: 0;
      }
      .no-findings p {
        margin: 0;
        color: var(--secondary-text-color);
      }
      .finding p {
        margin-bottom: 4px;
        overflow-wrap: anywhere;
      }
      .finding .path {
        font-size: 13px;
      }
      .finding button {
        margin-top: 6px;
      }
      .line {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 2px 10px;
        margin-bottom: 2px;
      }
      .check {
        font-size: 12px;
        color: var(--secondary-text-color);
        overflow-wrap: anywhere;
      }
      .note {
        margin: 0 0 12px;
        font-size: 13px;
      }
      button.small {
        min-height: 32px;
        padding: 0 14px;
        font-size: 13px;
      }
      .code {
        overflow: hidden;
        background-color: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 10px;
      }
      .code + .code {
        margin-top: 12px;
      }
      .code-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px 6px 14px;
        border-bottom: 1px solid var(--divider-color);
      }
      .code-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.04em;
        color: var(--secondary-text-color);
      }
      .code-label ha-icon {
        --mdc-icon-size: 16px;
      }
      .yaml {
        margin: 0;
        padding: 12px;
        overflow-x: auto;
        font-family: var(--code-font-family, monospace);
        font-size: 13px;
        line-height: 1.55;
        color: var(--primary-text-color);
        background-color: var(--secondary-background-color);
        border-radius: 8px;
      }
      .fragment .yaml {
        margin-top: 4px;
        border: 1px solid var(--divider-color);
      }
      .yaml.diff {
        padding: 0;
        border-radius: 0;
      }
      .dl:first-child {
        padding-top: 10px;
      }
      .dl:last-child {
        padding-bottom: 10px;
      }
      .dl {
        display: block;
        position: relative;
        padding: 0 14px 0 32px;
        white-space: pre;
      }
      .dl::before {
        position: absolute;
        left: 12px;
        content: " ";
        color: var(--secondary-text-color);
      }
      .dl.add {
        background-color: color-mix(in srgb, var(--success-color, var(--primary-color)) 14%, transparent);
      }
      .dl.add::before {
        content: "+";
        color: var(--success-color, var(--primary-color));
      }
      .dl.remove {
        background-color: color-mix(in srgb, var(--error-color) 14%, transparent);
      }
      .dl.remove::before {
        content: "-";
        color: var(--error-color);
      }
      /* The decision stays in view while the proposal is read. */
      .decision {
        margin-bottom: 0;
      }
      .decision.sticky {
        position: sticky;
        bottom: 0;
        z-index: 1;
        border-bottom-width: 0;
        border-radius: var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
      }
      .decide {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 20px;
      }
      .decision button.primary-action {
        min-height: 44px;
        padding-inline: 28px;
        font-size: 15px;
      }
      .decision .actions button {
        min-height: 44px;
      }
      .effect {
        flex: 1 1 240px;
        margin: 0;
        font-size: 13px;
      }
      .state {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin: 0 0 14px;
      }
      .created {
        margin: -6px 0 14px;
        padding: 0;
        list-style: none;
      }
      .created li {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 8px;
        align-items: baseline;
      }
      .created a {
        color: var(--primary-color);
      }
      .created code {
        overflow-wrap: anywhere;
      }
      @media (max-width: 480px) {
        .headline {
          font-size: 20px;
        }
        .decision.sticky {
          position: static;
          border-bottom-width: var(--ha-card-border-width, 1px);
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: none;
        }
      }
    `];
	}
};
customElements.define("ai-drafts-proposal", rn);
// src/views/request.ts
var an = class extends B {
	static {
		this.properties = {
			t: { attribute: !1 },
			language: { attribute: !1 },
			info: { attribute: !1 },
			models: { attribute: !1 },
			history: { attribute: !1 },
			currentId: { attribute: !1 },
			drafting: { type: Boolean },
			error: { attribute: !1 },
			exampleRequest: { attribute: !1 },
			_text: { state: !0 },
			_model: { state: !0 }
		};
	}
	constructor() {
		super(), this._text = "", this._model = null, this.drafting = !1, this.error = null;
	}
	updated(e) {
		e.get("drafting") === !0 && !this.drafting && !this.error && (this._text = "");
	}
	render() {
		let e = this.t, t = this._text.trim() !== "" && !this.drafting;
		return P`
      <section class="card compose ${this.drafting ? "busy" : ""}" aria-busy=${this.drafting ? "true" : "false"}>
        ${this.drafting ? P`<div class="progress" aria-hidden="true"><span></span></div>` : L}
        <h2>${e.requestHeading}</h2>
        <div class="request-field">
          <label for="request">${e.requestLabel}</label>
          <textarea
            id="request"
            rows="5"
            maxlength="4000"
            .value=${this._text}
            ?readonly=${this.drafting}
            placeholder=${e.requestPlaceholder}
            @input=${(e) => {
			this._text = e.target.value;
		}}
          ></textarea>
        </div>
        <div class="suggestion">
          <button
            class="secondary small"
            type="button"
            ?disabled=${this.drafting}
            @click=${() => {
			this._text = this.exampleRequest;
		}}
          >
            ${W("mdi:lightbulb-on-outline")}${e.useExample}
          </button>
          <span class="muted example">“${this.exampleRequest}”</span>
        </div>
        <div class="controls">
          ${this._renderModelField()}
          <button
            class="send"
            type="button"
            ?disabled=${!t}
            @click=${() => U(this, "create-draft", {
			request: this._text.trim(),
			model: this._modelToSend()
		})}
          >
            ${this.drafting ? P`<span class="spinner" aria-hidden="true"></span>` : W("mdi:creation-outline")}
            ${this.drafting ? e.drafting : e.createDraft}
          </button>
        </div>
        ${this._renderModelNote()}
        ${this.drafting ? P`<div class="alert info" role="status">
              ${W("mdi:timer-sand")}
              <div class="alert-body"><p>${e.draftingNote}</p></div>
            </div>` : L}
        ${this.error ? bt(e, this.error) : L}
      </section>
      <section class="card">
        <h2>${e.historyHeading}</h2>
        ${this._renderHistory()}
      </section>
      ${this._renderInfo()}
    `;
	}
	_modelChoices() {
		if (this.models.status !== "ready") return null;
		let { models: e, default: t } = this.models.models, n = t ?? "";
		return e.map((e) => {
			let t = e.id ?? "", r = e.id === null ? this.t.modelPreferred : e.label, i = t === n;
			return {
				value: t,
				label: i ? `${r} (${this.t.modelDefaultMark})` : r,
				isDefault: i
			};
		});
	}
	_selectedModel(e) {
		return (e.find((e) => e.value === this._model) ?? e.find((e) => e.isDefault) ?? e[0])?.value ?? "";
	}
	_modelToSend() {
		let e = this._modelChoices();
		if (!e) return;
		let t = this._selectedModel(e);
		if (!(e.find((e) => e.value === t)?.isDefault ?? !0)) return t === "" ? null : t;
	}
	_renderModelField() {
		let e = this.t, t = this._modelChoices();
		return P`
      <div class="field model-field">
        <label for="model">${e.modelLabel}</label>
        ${t ? P`
              <select
                id="model"
                ?disabled=${this.drafting}
                .value=${this._selectedModel(t)}
                @change=${(e) => {
			this._model = e.target.value;
		}}
              >
                ${t.map((e) => P`<option value=${e.value} ?selected=${e.value === this._selectedModel(t)}>
                    ${e.label}
                  </option>`)}
              </select>
            ` : this.models.status === "loading" ? P`<p class="muted loading-models">${e.modelsLoading}</p>` : P`<p class="finding-text">${e.modelsError}</p>`}
      </div>
    `;
	}
	_renderModelNote() {
		let e = this.t, t = this.models;
		return P`
      ${t.status === "error" ? P`<p class="muted note">${e.modelsUnavailable}: ${t.message}</p>` : L}
      ${t.status === "ready" && t.models.error ? P`<p class="note unavailable" role="status">
            ${e.modelsUnavailable}: ${t.models.error}
          </p>` : L}
      <p class="muted note">${e.modelNote}</p>
    `;
	}
	_renderInfo() {
		let e = this.t, t = this.info;
		if (t.status === "loading") return P`<p class="muted">${e.loading}</p>`;
		if (t.status === "error") return P`
        <div class="alert error" role="alert">
          ${W("mdi:alert-circle")}
          <div class="alert-body">
            <p>${e.error}</p>
            <p class="detail">${t.message}</p>
            <button type="button" class="secondary" @click=${() => U(this, "retry-info")}>${e.retry}</button>
          </div>
        </div>
      `;
		let { info: n } = t, r = n.model_source === "ai_task" ? e.sourceAiTask : n.model_source === "openai_compatible" ? e.sourceOpenai : "–", i = n.model ?? (n.model_source === "ai_task" ? e.preferredAiTask : "–");
		return P`
      <p class="info muted">
        <span>${e.version} ${n.version}</span>
        <span>${e.modelSource}: ${r}</span>
        <span>${e.model}: ${i}</span>
      </p>
    `;
	}
	_renderHistory() {
		let e = this.t, t = this.history;
		if (t.status === "loading") return P`<p class="muted">${e.historyLoading}</p>`;
		if (t.status === "error") return P`
        <div class="alert error" role="alert">
          ${W("mdi:alert-circle")}
          <div class="alert-body">
            <p>${e.historyError}</p>
            <p class="detail">${t.message}</p>
            <button type="button" class="secondary" @click=${() => U(this, "retry-history")}>${e.retry}</button>
          </div>
        </div>
      `;
		if (t.items.length === 0) return P`<div class="empty">
        ${W("mdi:history")}
        <p>${e.historyEmpty}</p>
        <p class="muted">${e.historyEmptyHint}</p>
      </div>`;
		let n = new Intl.DateTimeFormat(this.language, {
			dateStyle: "medium",
			timeStyle: "short"
		});
		return P`
      <p class="muted note hint">${e.historyOpenHint}</p>
      <ul class="history">
        ${t.items.map((t) => {
			let r = t.findings.find((e) => e.severity === "error"), i = t.id === this.currentId;
			return P`
            <li>
              <button
                type="button"
                class="entry ${t.status} ${i ? "current" : ""}"
                aria-current=${i ? "true" : "false"}
                @click=${() => U(this, "open-changeset", { id: t.id })}
              >
                <span class="lead">${W(gt(t.status))}</span>
                <span class="main">
                  <span class="text">${t.request}</span>
                  <span class="meta muted">
                    <span>${n.format(new Date(t.created))}</span>
                    ${t.model ? P`<span>${e.historyModel}: ${t.model}</span>` : L}
                    ${t.rounds > 0 ? P`<span>${e.roundsLabel(t.rounds)}</span>` : L}
                  </span>
                  ${t.status === "failed" && r ? P`<span class="finding-text">${r.message}</span>` : L}
                </span>
                <span class="side">
                  ${vt(e, t.status)}
                  ${i ? P`<span class="open">${e.currentBadge}</span>` : L}
                </span>
              </button>
            </li>
          `;
		})}
      </ul>
    `;
	}
	static {
		this.styles = [xt, o`
      label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        font-weight: 500;
        color: var(--secondary-text-color);
      }
      .compose {
        position: relative;
        overflow: hidden;
      }
      .request-field {
        min-width: 0;
      }
      textarea,
      select {
        box-sizing: border-box;
        width: 100%;
        font: inherit;
        color: var(--primary-text-color);
        background-color: var(--input-fill-color, var(--secondary-background-color));
        border: 1px solid var(--outline-color, var(--divider-color));
        border-radius: 10px;
      }
      textarea {
        min-height: 128px;
        padding: 14px 16px;
        font-size: 16px;
        line-height: 1.5;
        resize: vertical;
      }
      textarea::placeholder {
        color: var(--secondary-text-color);
        opacity: 0.8;
      }
      textarea:focus {
        border-color: var(--primary-color);
      }
      select {
        min-height: 40px;
        padding: 0 12px;
      }
      select:disabled,
      textarea[readonly] {
        opacity: 0.65;
      }
      .suggestion {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 12px;
        margin: 12px 0 0;
      }
      button.small {
        min-height: 32px;
        padding: 0 14px;
        font-size: 13px;
      }
      .example {
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px 16px;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--divider-color);
      }
      .model-field {
        flex: 0 1 300px;
        min-width: 0;
      }
      .model-field label {
        font-weight: 400;
        font-size: 12px;
      }
      button.send {
        min-width: 180px;
        min-height: 44px;
        font-size: 15px;
      }
      @media (max-width: 480px) {
        .model-field {
          flex-basis: 100%;
        }
        button.send {
          width: 100%;
        }
      }
      .unavailable {
        padding-inline-start: 8px;
        border-inline-start: 3px solid var(--warning-color, var(--divider-color));
        overflow-wrap: anywhere;
      }
      .loading-models {
        margin: 0;
      }
      .note {
        margin: 8px 0 0;
        font-size: 12px;
      }
      .info {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 16px;
        margin: 0;
        padding: 0 4px;
        font-size: 12px;
      }
      .alert {
        margin-top: 16px;
      }
      .alert button {
        min-height: 32px;
      }
      .spinner {
        display: inline-block;
        box-sizing: border-box;
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .progress {
        position: absolute;
        inset: 0 0 auto 0;
        height: 3px;
        background-color: color-mix(in srgb, var(--primary-color) 20%, transparent);
      }
      .progress span {
        display: block;
        width: 35%;
        height: 100%;
        background-color: var(--primary-color);
        animation: slide 1.6s ease-in-out infinite;
      }
      @keyframes slide {
        from {
          transform: translateX(-100%);
        }
        to {
          transform: translateX(300%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
          border-right-color: currentColor;
          border-style: dotted;
        }
        .progress span {
          width: 100%;
          animation: none;
          opacity: 0.6;
        }
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 24px 12px 12px;
        text-align: center;
      }
      .empty ha-icon {
        --mdc-icon-size: 40px;
        margin-bottom: 8px;
        color: var(--secondary-text-color);
      }
      .empty p {
        margin: 0 0 4px;
      }
      .hint {
        margin: -4px 0 12px;
      }
      .history {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .history li + li {
        margin-top: 8px;
      }
      button.entry {
        --status-color: var(--secondary-text-color);
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 12px;
        width: 100%;
        padding: 12px 14px;
        font-weight: 400;
        text-align: start;
        color: var(--primary-text-color);
        background-color: transparent;
        border: 1px solid var(--divider-color);
        border-radius: 10px;
      }
      button.entry:hover:not(:disabled) {
        filter: none;
        background-color: var(--secondary-background-color);
      }
      button.entry.current {
        background-color: color-mix(in srgb, var(--primary-color) 8%, transparent);
        border-color: var(--primary-color);
        border-inline-start-width: 4px;
        padding-inline-start: 11px;
      }
      button.entry.checked {
        --status-color: var(--primary-color);
      }
      button.entry.applied {
        --status-color: var(--success-color, var(--primary-color));
      }
      button.entry.failed {
        --status-color: var(--error-color);
      }
      button.entry.draft {
        --status-color: var(--warning-color);
      }
      .lead {
        display: grid;
        place-items: center;
        flex: none;
        width: 36px;
        height: 36px;
        color: var(--status-color);
        background-color: color-mix(in srgb, var(--status-color) 14%, transparent);
        border-radius: 50%;
      }
      .main {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .text {
        display: -webkit-box;
        overflow: hidden;
        font-size: 15px;
        line-height: 1.35;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0 14px;
        font-size: 12px;
      }
      .side {
        display: flex;
        flex: none;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
      }
      .open {
        font-size: 12px;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      @media (max-width: 480px) {
        button.entry {
          flex-wrap: wrap;
        }
        .main {
          flex-basis: calc(100% - 60px);
        }
        .side {
          flex-direction: row-reverse;
          align-items: center;
          margin-inline-start: 48px;
        }
      }
      .finding-text {
        display: block;
        margin-top: 2px;
        font-size: 13px;
        color: var(--error-color);
        overflow-wrap: anywhere;
      }
    `];
	}
};
customElements.define("ai-drafts-request", an);
// src/ai-drafts-panel.ts
function on() {
	try {
		return new URL(import.meta.url).searchParams.get("v") || null;
	} catch {
		return null;
	}
}
var sn = on(), cn = [
	"request",
	"proposal",
	"domain",
	"inventory"
], ln = {
	request: "mdi:message-text-outline",
	proposal: "mdi:clipboard-check-outline",
	domain: "mdi:home-analytics",
	inventory: "mdi:format-list-bulleted"
}, $ = Ye(Be, Ve), un = String(He.operations[0]?.after?.id ?? ""), dn = new Map([...ze.map((e) => [e.id, e.alias]), [un, String(He.operations[0]?.after?.alias ?? "")]]), fn = Ze($), pn = fn.filter((e) => e.id !== un), mn = new Map($.places.map((e) => [e.id, e.label])), hn = He.findings.flatMap((e) => e.net_refs), gn = fn.map((e) => ({
	info: e,
	alias: dn.get(e.id) ?? e.id,
	isProposal: e.id === un
})), _n = pn.map((e) => ({
	id: e.id,
	alias: dn.get(e.id) ?? e.id,
	mode: e.mode,
	description: Je(e, Re)
})), vn = $e(pn), yn = class extends B {
	static {
		this.properties = {
			hass: { attribute: !1 },
			narrow: { type: Boolean },
			route: { attribute: !1 },
			panel: { attribute: !1 },
			_info: { state: !0 },
			_latestHash: { state: !0 },
			_tab: { state: !0 },
			_history: { state: !0 },
			_models: { state: !0 },
			_current: { state: !0 },
			_part: { state: !0 },
			_drafting: { state: !0 },
			_draftError: { state: !0 },
			_pending: { state: !0 },
			_decisionError: { state: !0 },
			_marks: { state: !0 },
			_focus: { state: !0 },
			_mode: { state: !0 }
		};
	}
	constructor() {
		super(), this._requested = !1, this._historySeq = 0, this._modelsSeq = 0, this._viewsOpened = [], this._onCreateDraft = async (e) => {
			if (!this._drafting) {
				this._drafting = !0, this._draftError = null;
				try {
					let t = await je(this.hass, e.detail.request, e.detail.model);
					this._open(t);
				} catch (e) {
					this._draftError = V(e);
				} finally {
					this._drafting = !1;
				}
				this._loadHistory();
			}
		}, this._onDecide = async (e) => {
			let t = this._current;
			if (t && !this._pending) {
				this._pending = e.detail.decision, this._decisionError = null;
				try {
					this._current = await Me(this.hass, e.detail.decision, t.id, {
						decidedIn: this._part,
						viewsOpened: this._viewsOpened
					});
				} catch (e) {
					this._decisionError = V(e);
				} finally {
					this._pending = null;
				}
				this._loadHistory();
			}
		}, this._nameOf = (e) => {
			let t = this.hass?.states?.[e]?.attributes?.friendly_name;
			return typeof t == "string" && t ? t : e;
		}, this._onOpenChangeSet = (e) => {
			if (this._history.status !== "ready") return;
			let t = this._history.items.find((t) => t.id === e.detail.id);
			t && this._open(t);
		}, this._onShowFinding = (e) => {
			this._marks = et($, e.detail.netRefs), this._focus = null, this._go("domain");
		}, this._onFocusAutomation = (e) => {
			let { automationId: t, toggle: n } = e.detail;
			this._focus = n && this._focus === t ? null : t, n || (this._marks = tt, this._go("domain"));
		}, this._info = { status: "loading" }, this._latestHash = null, this._tab = "request", this._history = { status: "loading" }, this._models = { status: "loading" }, this._current = null, this._part = "description", this._drafting = !1, this._draftError = null, this._pending = null, this._decisionError = null, this._marks = tt, this._focus = null, this._mode = "house";
	}
	willUpdate(e) {
		let t = e.get("hass");
		this.hass && t?.connected === !1 && this.hass.connected === !0 && this._checkBundle(), this.hass && !this._requested && (this._requested = !0, this._loadInfo(), this._loadHistory(), this._loadModels());
	}
	async _loadInfo() {
		this._info = { status: "loading" };
		try {
			let e = await this.hass.callWS({ type: "ai_drafts/info" });
			this._info = {
				status: "ready",
				info: e
			}, this._latestHash = e.bundle_hash ?? null;
		} catch (e) {
			this._info = {
				status: "error",
				message: V(e).message
			};
		}
	}
	async _checkBundle() {
		try {
			let e = await this.hass.callWS({ type: "ai_drafts/info" });
			this._latestHash = e.bundle_hash ?? null;
		} catch {}
	}
	async _loadModels() {
		let e = ++this._modelsSeq;
		try {
			let t = await Ae(this.hass);
			if (e !== this._modelsSeq) return;
			this._models = {
				status: "ready",
				models: t
			};
		} catch (t) {
			if (e !== this._modelsSeq) return;
			this._models = {
				status: "error",
				message: V(t).message
			};
		}
	}
	async _loadHistory() {
		let e = ++this._historySeq;
		try {
			let t = await ke(this.hass);
			if (e !== this._historySeq) return;
			if (this._history = {
				status: "ready",
				items: t
			}, this._current && this._pending === null) {
				let e = t.find((e) => e.id === this._current?.id);
				e && (this._current = e);
			}
		} catch (t) {
			if (e !== this._historySeq) return;
			this._history = {
				status: "error",
				message: V(t).message
			};
		}
	}
	_open(e) {
		this._current = e, this._part = "description", this._viewsOpened = [], this._decisionError = null, this._go("proposal");
	}
	_go(e) {
		this._tab = e, this._visit(), e === "request" && (this._checkBundle(), this._loadHistory(), this._loadModels());
	}
	_setPart(e) {
		this._part = e, this._visit();
	}
	_visit() {
		if (!this._current) return;
		let e = this._tab === "proposal" ? `proposal.${this._part}` : this._tab;
		this._viewsOpened.includes(e) || (this._viewsOpened = [...this._viewsOpened, e]);
	}
	_outdated() {
		return sn !== null && this._latestHash !== null && this._latestHash !== sn;
	}
	render() {
		let e = Ge(this.hass?.locale?.language ?? this.hass?.language), t = this.hass?.locale?.language ?? this.hass?.language, n = {
			request: e.tabRequest,
			proposal: e.tabProposal,
			domain: e.tabDomain,
			inventory: e.tabInventory
		};
		return P`
      <div class="header">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">${e.title}</div>
      </div>
      ${this._outdated() ? P`<div class="outdated" role="alert">
            <div class="outdated-text">
              <strong>${e.outdatedTitle}</strong>
              <span>${e.outdatedText}</span>
            </div>
            <button type="button" class="outdated-button" @click=${() => location.reload()}>
              ${e.outdatedReload}
            </button>
          </div>` : L}
      <div class="tabs" role="tablist">
        ${cn.map((e) => P`<button
            type="button"
            role="tab"
            id="tab-${e}"
            aria-selected=${this._tab === e ? "true" : "false"}
            aria-controls="view-${e}"
            class=${this._tab === e ? "active" : ""}
            @click=${() => this._go(e)}
          >
            <ha-icon icon=${ln[e]}></ha-icon>
            <span>${n[e]}</span>
          </button>`)}
      </div>
      <div
        class="content"
        @create-draft=${this._onCreateDraft}
        @open-changeset=${this._onOpenChangeSet}
        @decide=${this._onDecide}
        @set-part=${(e) => this._setPart(e.detail.part)}
        @goto-request=${() => this._go("request")}
        @retry-info=${() => void this._loadInfo()}
        @retry-history=${() => void this._loadHistory()}
        @show-finding=${this._onShowFinding}
        @mark-example=${() => this._marks = et($, hn)}
        @focus-automation=${this._onFocusAutomation}
        @clear-marks=${() => this._marks = tt}
        @clear-focus=${() => this._focus = null}
        @set-mode=${(e) => this._mode = e.detail.mode}
      >
        ${this._renderViews(e, t)}
      </div>
    `;
	}
	_renderViews(e, t) {
		return P`
      <div class="view" id="view-request" role="tabpanel" ?hidden=${this._tab !== "request"}>
        <ai-drafts-request
          .t=${e}
          .language=${t}
          .info=${this._info}
          .models=${this._models}
          .history=${this._history}
          .currentId=${this._current?.id ?? null}
          .drafting=${this._drafting}
          .error=${this._draftError}
          .exampleRequest=${He.request}
        ></ai-drafts-request>
      </div>
      <div class="view" id="view-proposal" role="tabpanel" ?hidden=${this._tab !== "proposal"}>
        <ai-drafts-proposal
          .t=${e}
          .language=${t}
          .proposal=${this._current}
          .section=${this._part}
          .nameOf=${this._nameOf}
          .pending=${this._pending}
          .error=${this._decisionError}
        ></ai-drafts-proposal>
      </div>
      <div class="view wide" id="view-domain" role="tabpanel" ?hidden=${this._tab !== "domain"}>
        <ai-drafts-domain
          .t=${e}
          .language=${t}
          .house=${Re}
          .net=${$}
          .automations=${gn}
          .marks=${this._marks}
          .focusId=${this._focus}
          .mode=${this._mode}
        ></ai-drafts-domain>
      </div>
      <div class="view" id="view-inventory" role="tabpanel" ?hidden=${this._tab !== "inventory"}>
        <ai-drafts-inventory
          .t=${e}
          .items=${_n}
          .dependencies=${vn}
          .stateLabelOf=${(e) => mn.get(e) ?? e}
        ></ai-drafts-inventory>
      </div>
    `;
	}
	static {
		this.styles = o`
    :host {
      display: block;
      min-height: 100vh;
      background-color: var(--primary-background-color);
      color: var(--primary-text-color);
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      height: var(--header-height, 56px);
      padding: 0 12px;
      background-color: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color));
      border-bottom: var(--app-header-border-bottom, none);
    }
    .title {
      font-size: 20px;
      font-weight: 400;
    }
    .outdated {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background-color: var(--warning-color);
      color: var(--text-primary-color, #fff);
    }
    .outdated-text {
      display: flex;
      flex: 1 1 280px;
      flex-direction: column;
      gap: 2px;
      font-size: 14px;
    }
    .outdated-button {
      flex: none;
      padding: 8px 16px;
      font: inherit;
      font-weight: 500;
      color: var(--primary-text-color);
      background-color: var(--card-background-color, var(--primary-background-color));
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-border-radius, 4px);
      cursor: pointer;
    }
    .outdated-button:focus-visible {
      outline: 2px solid var(--primary-text-color);
      outline-offset: 2px;
    }
    .tabs {
      display: flex;
      overflow-x: auto;
      background-color: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color));
      border-bottom: 1px solid var(--divider-color);
      scrollbar-width: none;
    }
    .tabs button {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 8px;
      min-height: 48px;
      padding: 0 16px;
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      color: inherit;
      white-space: nowrap;
      cursor: pointer;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      opacity: 0.7;
    }
    .tabs button ha-icon {
      --mdc-icon-size: 20px;
    }
    .tabs button:hover {
      opacity: 1;
      background-color: color-mix(in srgb, currentColor 8%, transparent);
    }
    .tabs button.active {
      border-bottom-color: currentColor;
      opacity: 1;
    }
    .tabs button.active ha-icon {
      color: var(--primary-color);
    }
    .tabs button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: -4px;
    }
    .content {
      padding: 20px 16px 32px;
    }
    @media (max-width: 480px) {
      .tabs button {
        padding: 0 12px;
      }
      .content {
        padding: 12px 12px 24px;
      }
    }
    .view {
      max-width: 800px;
      margin: 0 auto;
    }
    .view.wide {
      max-width: 1320px;
    }
    .view[hidden] {
      display: none;
    }
  `;
	}
};
customElements.define("ai-drafts-panel", yn);
