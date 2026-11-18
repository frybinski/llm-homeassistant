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
var C = globalThis, w = (e) => e, T = C.trustedTypes, E = T ? T.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, D = "$lit$", O = `lit$${Math.random().toFixed(9).slice(2)}$`, k = "?" + O, te = `<${k}>`, A = document, j = () => A.createComment(""), M = (e) => e === null || typeof e != "object" && typeof e != "function", ne = Array.isArray, re = (e) => ne(e) || typeof e?.[Symbol.iterator] == "function", ie = "[ 	\n\f\r]", N = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ae = /-->/g, oe = />/g, P = RegExp(`>|${ie}(?:([^\\s"'>=/]+)(${ie}*=${ie}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), se = /'/g, ce = /"/g, le = /^(?:script|style|textarea|title)$/i, ue = (e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}), F = ue(1), I = ue(2), L = Symbol.for("lit-noChange"), R = Symbol.for("lit-nothing"), de = /* @__PURE__ */ new WeakMap(), z = A.createTreeWalker(A, 129);
function fe(e, t) {
	if (!ne(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return E === void 0 ? t : E.createHTML(t);
}
var pe = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = N;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === N ? c[1] === "!--" ? o = ae : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = P) : (le.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = P) : o = oe : o === P ? c[0] === ">" ? (o = i ?? N, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? P : c[3] === "\"" ? ce : se) : o === ce || o === se ? o = P : o === ae || o === oe ? o = N : (o = P, i = void 0);
		let d = o === P && e[t + 1].startsWith("/>") ? " " : "";
		a += o === N ? n + te : l >= 0 ? (r.push(s), n.slice(0, l) + D + n.slice(l) + O + d) : n + O + (l === -2 ? t : d);
	}
	return [fe(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, me = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = pe(t, n);
		if (this.el = e.createElement(l, r), z.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = z.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(D)) {
					let t = u[o++], n = i.getAttribute(e).split(O), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? _e : r[1] === "?" ? ve : r[1] === "@" ? ye : V
					}), i.removeAttribute(e);
				} else e.startsWith(O) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (le.test(i.tagName)) {
					let e = i.textContent.split(O), t = e.length - 1;
					if (t > 0) {
						i.textContent = T ? T.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], j()), z.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], j());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === k) c.push({
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
		let n = A.createElement("template");
		return n.innerHTML = e, n;
	}
};
function B(e, t, n = e, r) {
	if (t === L) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = M(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = B(e, i._$AS(e, t.values), i, r)), t;
}
var he = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? A).importNode(t, !0);
		z.currentNode = r;
		let i = z.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new ge(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new be(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = z.nextNode(), a++);
		}
		return z.currentNode = A, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, ge = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = R, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = B(this, e, t), M(e) ? e === R || e == null || e === "" ? (this._$AH !== R && this._$AR(), this._$AH = R) : e !== this._$AH && e !== L && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? re(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== R && M(this._$AH) ? this._$AA.nextSibling.data = e : this.T(A.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = me.createElement(fe(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new he(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = de.get(e.strings);
		return t === void 0 && de.set(e.strings, t = new me(e)), t;
	}
	k(t) {
		ne(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(j()), this.O(j()), this, this.options)) : r = n[i], r._$AI(a), i++;
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
}, V = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = R, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = R;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = B(this, e, t, 0), a = !M(e) || e !== this._$AH && e !== L, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = B(this, r[n + o], t, o), s === L && (s = this._$AH[o]), a ||= !M(s) || s !== this._$AH[o], s === R ? e = R : e !== R && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === R ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, _e = class extends V {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === R ? void 0 : e;
	}
}, ve = class extends V {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== R);
	}
}, ye = class extends V {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = B(this, e, t, 0) ?? R) === L) return;
		let n = this._$AH, r = e === R && n !== R || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== R && (n === R || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, be = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		B(this, e);
	}
}, xe = C.litHtmlPolyfillSupport;
xe?.(me, ge), (C.litHtmlVersions ??= []).push("3.3.3");
var Se = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new ge(t.insertBefore(j(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Ce = globalThis, H = class extends S {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Se(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return L;
	}
};
H._$litElement$ = !0, H.finalized = !0, Ce.litElementHydrateSupport?.({ LitElement: H });
var we = Ce.litElementPolyfillSupport;
we?.({ LitElement: H }), (Ce.litElementVersions ??= []).push("4.2.2");
// src/demo/automations.json
var Te = [
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
], Ee = [
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
], De = {
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
}, Oe = {
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
}, ke = {
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
}, Ae = De, je = Te, Me = Oe, Ne = ke, Pe = Ee, U = Pe[0], Fe = Pe.slice(1), Ie = {
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
	demoTitle: "Example data",
	demoText: "This view shows fixed example data. No model is called and nothing is written to Home Assistant.",
	tabRequest: "Request and history",
	tabProposal: "Proposal and findings",
	tabDomain: "Domain view",
	tabInventory: "Inventory",
	requestHeading: "New request",
	requestLabel: "What should Home Assistant do?",
	requestPlaceholder: "Describe the automation in your own words",
	useExample: "Use the example request",
	createDraft: "Create draft",
	createHint: "In the showcase, creating a draft always opens the prepared proposal.",
	historyHeading: "History",
	historyEmpty: "No proposals yet.",
	openProposal: "Open",
	roundsLabel: (e) => `${e} repair ${e === 1 ? "round" : "rounds"}`,
	statusDraft: "Draft",
	statusChecked: "Checked",
	statusFailed: "Failed",
	statusApplied: "Applied",
	statusReverted: "Reverted",
	statusDiscarded: "Discarded",
	noProposal: "There is no proposal yet. Create a draft from a request first.",
	toRequest: "To the request",
	proposalHeading: "Proposal",
	summaryHeading: "What the proposal does",
	creates: "Creates the automation",
	trigger: "Trigger",
	condition: "Condition",
	effect: "Effect",
	room: "Room",
	rooms: "Rooms",
	none: "none",
	modeLabel: "Mode",
	modeRestart: "restart: a new trigger starts the run again",
	modeSingle: "single: a running run is not interrupted",
	after: (e) => `after ${e}`,
	findingsHeading: "Findings",
	noFindings: "No findings.",
	severityError: "Error",
	severityWarning: "Warning",
	severityInfo: "Note",
	showInDomain: "Show in domain view",
	yamlSummary: "Automation as YAML",
	yamlNote: "Secondary view for checking. Display only, nothing is written.",
	apply: "Apply",
	discard: "Discard",
	revert: "Revert",
	blockedByErrors: "Error findings block applying.",
	stateApplied: "Applied in the showcase. The automation now appears in the inventory. Nothing was written to Home Assistant.",
	stateReverted: "Reverted. The automation is gone from the inventory again.",
	stateDiscarded: "Discarded.",
	stateFailed: "This proposal failed and cannot be applied.",
	decidedAt: (e) => `Decided ${e}`,
	viewHouse: "House",
	viewNet: "Net",
	viewMode: "Representation",
	noRoom: "No room",
	proposalBadge: "Proposal",
	marksActive: "Elements named by the finding are marked.",
	focusActive: (e) => `Focus: ${e}`,
	clear: "Clear",
	legendHeading: "Legend",
	legendExisting: "Existing automation",
	legendProposal: "Proposal",
	legendMarked: "Named by a finding",
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
	newBadge: "New",
	showInDomainView: "Show in domain view",
	dependenciesHeading: "Dependencies",
	noDependencies: "No dependencies on other automations.",
	writesFor: (e, t, n) => `Writes “${e}”, which “${t}” uses as ${n}.`,
	readsFrom: (e, t, n) => `Uses “${e}” as ${n}, written by “${t}”.`,
	roleTrigger: "trigger",
	roleCondition: "condition",
	summaryArrow: "→",
	unitHour: ["hour", "hours"],
	unitMinute: ["minute", "minutes"],
	unitSecond: ["second", "seconds"]
}, Le = {
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
	demoTitle: "Beispieldaten",
	demoText: "Diese Ansicht zeigt feste Beispieldaten. Es wird kein Modell aufgerufen und nichts in Home Assistant geschrieben.",
	tabRequest: "Anfrage und Verlauf",
	tabProposal: "Vorschlag und Befunde",
	tabDomain: "Domänenansicht",
	tabInventory: "Bestand",
	requestHeading: "Neue Anfrage",
	requestLabel: "Was soll Home Assistant tun?",
	requestPlaceholder: "Beschreibe die Automation in eigenen Worten",
	useExample: "Beispielanfrage übernehmen",
	createDraft: "Entwurf erstellen",
	createHint: "Im Schaukasten öffnet „Entwurf erstellen“ immer den vorbereiteten Vorschlag.",
	historyHeading: "Verlauf",
	historyEmpty: "Noch keine Vorschläge.",
	openProposal: "Öffnen",
	roundsLabel: (e) => `${e} ${e === 1 ? "Reparaturrunde" : "Reparaturrunden"}`,
	statusDraft: "Entwurf",
	statusChecked: "Geprüft",
	statusFailed: "Fehlgeschlagen",
	statusApplied: "Übernommen",
	statusReverted: "Rückgängig gemacht",
	statusDiscarded: "Verworfen",
	noProposal: "Es gibt noch keinen Vorschlag. Erstelle zuerst einen Entwurf aus einer Anfrage.",
	toRequest: "Zur Anfrage",
	proposalHeading: "Vorschlag",
	summaryHeading: "Was der Vorschlag tut",
	creates: "Legt die Automation an",
	trigger: "Auslöser",
	condition: "Bedingung",
	effect: "Wirkung",
	room: "Raum",
	rooms: "Räume",
	none: "keine",
	modeLabel: "Modus",
	modeRestart: "restart: ein neuer Auslöser startet den Ablauf neu",
	modeSingle: "single: ein laufender Ablauf wird nicht unterbrochen",
	after: (e) => `nach ${e}`,
	findingsHeading: "Befunde",
	noFindings: "Keine Befunde.",
	severityError: "Fehler",
	severityWarning: "Warnung",
	severityInfo: "Hinweis",
	showInDomain: "In der Domänenansicht zeigen",
	yamlSummary: "Automation als YAML",
	yamlNote: "Zweite Ansicht zur Kontrolle. Nur Anzeige, es wird nichts geschrieben.",
	apply: "Übernehmen",
	discard: "Verwerfen",
	revert: "Rückgängig",
	blockedByErrors: "Fehler-Befunde sperren das Übernehmen.",
	stateApplied: "Im Schaukasten übernommen. Die Automation erscheint jetzt im Bestand. Es wurde nichts in Home Assistant geschrieben.",
	stateReverted: "Rückgängig gemacht. Die Automation ist wieder aus dem Bestand verschwunden.",
	stateDiscarded: "Verworfen.",
	stateFailed: "Dieser Vorschlag ist fehlgeschlagen und lässt sich nicht übernehmen.",
	decidedAt: (e) => `Entschieden ${e}`,
	viewHouse: "Haus",
	viewNet: "Netz",
	viewMode: "Darstellung",
	noRoom: "Ohne Raum",
	proposalBadge: "Vorschlag",
	marksActive: "Die vom Befund genannten Elemente sind markiert.",
	focusActive: (e) => `Fokus: ${e}`,
	clear: "Aufheben",
	legendHeading: "Legende",
	legendExisting: "Bestehende Automation",
	legendProposal: "Vorschlag",
	legendMarked: "Vom Befund genannt",
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
	newBadge: "Neu",
	showInDomainView: "In der Domänenansicht zeigen",
	dependenciesHeading: "Abhängigkeiten",
	noDependencies: "Keine Abhängigkeiten zu anderen Automationen.",
	writesFor: (e, t, n) => `Schreibt „${e}“, das „${t}“ als ${n} nutzt.`,
	readsFrom: (e, t, n) => `Nutzt „${e}“ als ${n}, geschrieben von „${t}“.`,
	roleTrigger: "Auslöser",
	roleCondition: "Bedingung",
	summaryArrow: "→",
	unitHour: ["Stunde", "Stunden"],
	unitMinute: ["Minute", "Minuten"],
	unitSecond: ["Sekunde", "Sekunden"]
};
function Re(e) {
	return e?.toLowerCase().startsWith("de") ? Le : Ie;
}
function ze(e, t) {
	return {
		draft: e.statusDraft,
		checked: e.statusChecked,
		failed: e.statusFailed,
		applied: e.statusApplied,
		reverted: e.statusReverted,
		discarded: e.statusDiscarded
	}[t] ?? t;
}
function Be(e, t) {
	let n = e?.toLowerCase().startsWith("de");
	return {
		on: ["on", "an"],
		off: ["off", "aus"],
		playing: ["playing", "läuft"],
		above_horizon: ["above horizon", "über dem Horizont"],
		below_horizon: ["below horizon", "unter dem Horizont"]
	}[t]?.[+!!n] ?? t;
}
// src/logic/changeset-machine.ts
var Ve = {
	draft: [
		"checked",
		"failed",
		"discarded"
	],
	checked: ["applied", "discarded"],
	failed: ["discarded"],
	applied: ["reverted"],
	reverted: [],
	discarded: []
}, He = {
	apply: "applied",
	discard: "discarded",
	revert: "reverted"
};
function Ue(e) {
	return e.findings.some((e) => e.severity === "error");
}
function We(e, t) {
	return Ve[e.status].includes(He[t]) ? !(t === "apply" && Ue(e)) : !1;
}
function Ge(e, t) {
	if (!We(e, t)) throw Error(`cannot ${t} a change set in status '${e.status}'`);
	let n = t === "revert" ? e.decided : (/* @__PURE__ */ new Date()).toISOString();
	return {
		...e,
		status: He[t],
		decided: n
	};
}
// src/logic/describe.ts
function Ke(e, t) {
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
function qe(...e) {
	return {
		format: e[0].format,
		version: e[0].version,
		places: e.flatMap((e) => e.places),
		transitions: e.flatMap((e) => e.transitions),
		arcs: e.flatMap((e) => e.arcs)
	};
}
function Je(e, t) {
	return e.annotations.find((e) => e.type === t)?.value ?? null;
}
function Ye(e) {
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
			a.mode ??= Je(i, "mode");
			let e = o.filter((e) => e.kind === "read").map((e) => t.get(e.source)).filter((e) => e?.kind === "state"), n = e.find((e) => e.entity_id === i.origin.entity_id);
			a.triggers.push({
				transitionId: i.id,
				label: i.label,
				entityId: i.origin.entity_id ?? null,
				areaId: i.origin.area_id ?? null,
				placeId: n?.id ?? null,
				event: Je(i, "event")
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
				delay: Je(i, "delay")
			});
		}
	}
	for (let e of n.values()) e.reads = Xe([...e.triggers.flatMap((e) => e.placeId ? [e.placeId] : []), ...e.conditions.map((e) => e.placeId)]), e.writes = Xe(e.effects.map((e) => e.placeId));
	return [...n.values()];
}
function Xe(e) {
	return [...new Set(e)];
}
function Ze(e) {
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
function Qe(e, t) {
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
var W = {
	entityIds: /* @__PURE__ */ new Set(),
	automationIds: /* @__PURE__ */ new Set(),
	placeIds: /* @__PURE__ */ new Set(),
	transitionIds: /* @__PURE__ */ new Set()
};
// src/logic/text.ts
function $e(e, t, n) {
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
function et(e, t) {
	let n = /^(\d+):(\d{2}):(\d{2})$/.exec(e);
	if (!n) return e;
	let r = [], i = (e, [t, n]) => {
		e > 0 && r.push(`${e} ${e === 1 ? t : n}`);
	};
	return i(Number(n[1]), t.hour), i(Number(n[2]), t.minute), i(Number(n[3]), t.second), r.join(" ") || e;
}
var tt = 12, nt = 12, rt = 180, it = 204, G = 16, at = 26;
function K(e, t) {
	return e ?? `event:${t}`;
}
function ot(e, t, n, r, i = "mdi:clock-outline") {
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
	for (let e of t) for (let t of e.triggers) t.entityId === null && u(K(null, t.transitionId), s, {
		entityId: null,
		name: r(t.transitionId),
		icon: i,
		state: ""
	});
	let f = (e, t) => t.some((t) => t.channel === e), p = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = [
			...e.triggers.map((e) => c.get(K(e.entityId, e.transitionId))?.col),
			...e.effects.map((e) => c.get(e.entityId)?.col),
			...e.conditions.map((e) => c.get(e.entityId)?.col)
		].filter((e) => e !== void 0), n = e.triggers.map((e) => c.get(K(e.entityId, e.transitionId))?.col).find((e) => e !== void 0) ?? 0, r = t.filter((e) => e < n).length, i = t.filter((e) => e > n).length, o = r > i || r === i && n === a.length - 1;
		p.set(e.id, o ? n : n + 1);
	}
	let m = [...p.values()].map((e) => ({ channel: e })), h = f(0, m) ? it : 0, g = (e) => G + h + e * 384, ee = (e) => g(e) - it / 2, _ = f(a.length, m) ? it : 0, v = [], y = [], b = 0;
	a.forEach((e, t) => {
		let n = l[t], r = 48 + n.length * 64 - tt + nt;
		y.push({
			id: e.id,
			name: e.name,
			icon: e.icon,
			col: t,
			x: g(t),
			y: G,
			w: rt,
			h: r
		}), n.forEach((e, n) => {
			let r = c.get(e);
			r && v.push({
				...r,
				x: g(t) + nt,
				y: 64 + n * 64
			});
		}), b = Math.max(b, G + r);
	});
	let x = new Map(v.map((e) => [e.key, e])), S = [];
	for (let e of t) {
		for (let t of e.triggers) S.push({
			automationId: e.id,
			kind: "trigger",
			tileKey: K(t.entityId, t.transitionId)
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
		let t = S.filter((t) => t.automationId === e.id).map((e) => x.get(e.tileKey)).filter((e) => e !== void 0).map((e) => e.y + 26), n = t.length ? t.reduce((e, t) => e + t, 0) / t.length : G, r = p.get(e.id) ?? 0;
		w.set(r, [...w.get(r) ?? [], {
			id: e.id,
			want: n
		}]);
	}
	for (let [e, t] of w) {
		t.sort((e, t) => e.want - t.want || e.id.localeCompare(t.id));
		let r = G;
		for (let i of t) {
			let t = Math.max(r, i.want - 23);
			C.push({
				automationId: i.id,
				channel: e,
				x: ee(e) - 70,
				y: t,
				lines: $e(n(i.id), 18, 2)
			}), r = t + 46 + at, b = Math.max(b, t + 46 + G);
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
	let k = (e, t, n, r) => n + r * (e.indexOf(t) + 1) / (e.length + 1), te = E.map((e) => {
		let t = D.get(`${e.tile.key}|${e.side}`) ?? [e], n = O.get(`${e.hub.automationId}|${-e.side}`) ?? [e], r = e.side === 1 ? e.tile.x + 156 : e.tile.x, i = k(t, e, e.tile.y, 52), a = e.side === 1 ? e.hub.x : e.hub.x + 140, o = k(n, e, e.hub.y, 46), [s, c, l, u, d, f] = e.link.kind === "effect" ? [
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
		width: g(a.length - 1) + rt + _ + G,
		height: b + G,
		rooms: y,
		tiles: v,
		hubs: C,
		edges: te
	};
}
var st = 84, ct = 40;
function lt(e, t) {
	let n = e.transitions.filter((e) => e.origin.automation_id === t), r = new Set(n.map((e) => e.id)), i = e.arcs.filter((e) => r.has(e.kind === "produce" ? e.source : e.target)), a = new Set(i.map((e) => e.kind === "produce" ? e.target : e.source));
	return {
		transitions: n,
		arcs: i,
		places: e.places.filter((e) => a.has(e.id) || e.origin.automation_id === t)
	};
}
function ut(e, t) {
	let { transitions: n, arcs: r, places: i } = lt(e, t), a = new Map(i.map((e) => [e.id, e])), o = new Map(n.map((e) => [e.id, e])), s = /* @__PURE__ */ new Map(), c = n.filter((e) => e.kind === "trigger"), l = n.filter((e) => e.kind === "action"), u = /* @__PURE__ */ new Set();
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
	let h = Math.max(0, ...[...f.values()].map((e) => e.up.length)), g = Math.max(1, ...[...f.values()].map((e) => e.mid.length)), ee = Math.max(0, ...[...f.values()].map((e) => e.down.length)), _ = ct + h * 120, v = /* @__PURE__ */ new Map();
	for (let [e, t] of f) {
		let n = st + e * 150;
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
			lines: $e(i, 22, 2),
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
		height: _ + (g + ee) * 120 + ct,
		nodes: y,
		edges: x
	};
}
// src/views/shared.ts
function q(e, t, n) {
	e.dispatchEvent(new CustomEvent(t, {
		detail: n,
		bubbles: !0,
		composed: !0
	}));
}
function J(e) {
	return F`
    <div class="demo-banner" role="note">
      <span class="demo-tag">${e.demoTitle}</span>
      <span>${e.demoText}</span>
    </div>
  `;
}
var Y = o`
  :host {
    display: block;
    color: var(--primary-text-color);
  }
  h2 {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 500;
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
  .demo-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin-bottom: 16px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--primary-text-color);
    background-color: var(--secondary-background-color);
    border: 1px dashed var(--warning-color, var(--primary-color));
    border-radius: 8px;
  }
  .demo-tag {
    padding: 1px 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-primary-color);
    background-color: var(--warning-color, var(--primary-color));
    border-radius: 10px;
  }
  .card {
    margin-bottom: 16px;
    padding: 16px;
    background-color: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: var(--ha-card-border-radius, 12px);
  }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
    white-space: nowrap;
    color: var(--primary-text-color);
    background-color: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 12px;
  }
  .badge.applied,
  .badge.checked {
    border-color: var(--success-color, var(--primary-color));
  }
  .badge.failed,
  .badge.error {
    border-color: var(--error-color);
  }
  .badge.warning {
    border-color: var(--warning-color);
  }
  .badge.discarded,
  .badge.reverted,
  .badge.info {
    border-color: var(--secondary-text-color);
  }
  .badge.proposal {
    color: var(--text-primary-color);
    background-color: var(--primary-color);
    border-color: var(--primary-color);
  }
  button {
    font: inherit;
    padding: 8px 16px;
    cursor: pointer;
    color: var(--text-primary-color);
    background-color: var(--primary-color);
    border: 1px solid var(--primary-color);
    border-radius: 8px;
  }
  button.secondary {
    color: var(--primary-color);
    background-color: transparent;
    border-color: var(--primary-color);
  }
  button.danger {
    color: var(--error-color);
    background-color: transparent;
    border-color: var(--error-color);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  button:focus-visible,
  textarea:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  ha-icon {
    --mdc-icon-size: 20px;
    flex: none;
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
`, dt = class extends H {
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
		(!this._layout || e.some((e, t) => e !== this._layoutKey[t])) && (this._layoutKey = e, this._layout = ot(this.house, this.automations.map((e) => e.info), (e) => this._alias(e), (e) => this.automations.flatMap((e) => e.info.triggers).find((t) => t.transitionId === e)?.label ?? ""));
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
		return F`
      ${J(e)}
      <div class="toolbar">
        <div class="segmented" role="group" aria-label=${e.viewMode}>
          ${["house", "net"].map((t) => F`<button
              type="button"
              class=${this.mode === t ? "on" : ""}
              aria-pressed=${this.mode === t ? "true" : "false"}
              @click=${() => q(this, "set-mode", { mode: t })}
            >
              ${t === "house" ? e.viewHouse : e.viewNet}
            </button>`)}
        </div>
        ${this._hasMarks ? F`<span class="chip marked">
              ${e.marksActive}
              <button type="button" class="link" @click=${() => q(this, "clear-marks")}>
                ${e.clear}
              </button>
            </span>` : R}
        ${this.focusId ? F`<span class="chip">
              ${e.focusActive(this._alias(this.focusId))}
              <button type="button" class="link" @click=${() => q(this, "clear-focus")}>
                ${e.clear}
              </button>
            </span>` : R}
      </div>
      ${this.mode === "house" ? this._renderHouse() : this._renderNet()}
    `;
	}
	_renderHouse() {
		let e = this.t, t = this._layout;
		if (!t) return R;
		let n = this.focusId, r = new Set(t.edges.filter((e) => e.automationId === n).map((e) => e.tileKey)), i = new Set(this.automations.filter((e) => e.isProposal).map((e) => e.info.id)), a = (e) => n !== null && e !== n;
		return F`
      <div class="scroll">
        <svg
          class="diagram house"
          viewBox="0 0 ${t.width} ${t.height}"
          style="width:100%;min-width:${Math.round(t.width * .7)}px;max-width:${t.width}px"
          role="img"
          aria-label=${e.houseLabel}
        >
          ${this._markers()}
          ${t.rooms.map((t) => I`
              <g class="room">
                <rect x=${t.x} y=${t.y} width=${t.w} height=${t.h} rx="12"></rect>
                <text class="room-name" x=${t.x + 14} y=${t.y + 23}>${t.name ?? e.noRoom}</text>
              </g>`)}
          ${t.edges.map((e) => I`
              <path
                class="edge ${e.kind} ${i.has(e.automationId) ? "proposal" : ""} ${a(e.automationId) ? "dim" : ""}"
                d=${e.d}
                marker-end=${e.kind === "condition" ? "url(#m-cond)" : "url(#m-arrow)"}
              ></path>`)}
          ${t.tiles.map((e) => {
			let t = e.entityId !== null && this.marks.entityIds.has(e.entityId), i = n !== null && !r.has(e.key);
			return I`
              <g class="tile ${t ? "marked" : ""} ${i ? "dim" : ""}">
                ${t ? I`<rect class="halo" x=${e.x - 4} y=${e.y - 4} width=${164} height=${60} rx="12"></rect>` : R}
                <rect class="tile-box" x=${e.x} y=${e.y} width=${156} height=${52} rx="8"></rect>
                <foreignObject x=${e.x + 8} y=${e.y + 12} width="28" height="28">
                  <div class="icon-wrap"><ha-icon icon=${e.icon}></ha-icon></div>
                </foreignObject>
                <text class="tile-name" x=${e.x + 42} y=${e.state ? e.y + 22 : e.y + 31}>${ft(e.name, 18)}</text>
                ${e.state ? I`<text class="tile-state" x=${e.x + 42} y=${e.y + 40}>${Be(this.language, e.state)}</text>` : R}
              </g>`;
		})}
          ${t.hubs.map((t) => {
			let r = this.automations.find((e) => e.info.id === t.automationId)?.isProposal ?? !1, i = this.marks.automationIds.has(t.automationId), o = t.y + (46 - t.lines.length * 15) / 2 + 11;
			return I`
              <g
                class="hub ${r ? "proposal" : ""} ${i ? "marked" : ""} ${a(t.automationId) ? "dim" : ""} ${n === t.automationId ? "focused" : ""}"
                tabindex="0"
                role="button"
                aria-label=${this._alias(t.automationId)}
                @click=${() => q(this, "focus-automation", {
				automationId: t.automationId,
				toggle: !0
			})}
                @keydown=${(e) => {
				(e.key === "Enter" || e.key === " ") && (e.preventDefault(), q(this, "focus-automation", {
					automationId: t.automationId,
					toggle: !0
				}));
			}}
              >
                ${i ? I`<rect class="halo" x=${t.x - 4} y=${t.y - 4} width=${148} height=${54} rx="14"></rect>` : R}
                <rect class="hub-box" x=${t.x} y=${t.y} width=${140} height=${46} rx="12"></rect>
                ${t.lines.map((e, n) => I`<text class="hub-text" x=${t.x + 70} y=${o + n * 15}>${e}</text>`)}
                ${r ? I`<g class="badge-svg">
                      <rect x=${t.x + 140 - 74} y=${t.y - 9} width="70" height="18" rx="9"></rect>
                      <text x=${t.x + 140 - 39} y=${t.y + 4}>${e.proposalBadge}</text>
                    </g>` : R}
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
		return F`
      <h2 class="net-heading">${e.netHeading}</h2>
      <p class="muted">${e.netHint}</p>
      ${t.map((e) => this._renderDiagram(e))} ${this._legend(!0)}
    `;
	}
	_renderDiagram(e) {
		let t = this.t, n = ut(this.net, e.info.id), r = {
			mode: t.annotationMode,
			delay: t.annotationDelay,
			event: t.annotationEvent,
			guard: t.annotationGuard
		}, i = (e) => this.marks.placeIds.has(e) || this.marks.transitionIds.has(e);
		return F`
      <section class="card net-card ${e.isProposal ? "proposal" : ""}">
        <div class="net-head">
          <h3>${e.alias}</h3>
          ${e.isProposal ? F`<span class="badge proposal">${t.proposalBadge}</span>` : R}
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
			return I`<path class="arc ${e.kind} ${t ? "marked" : ""}" d=${e.d} marker-end="url(#m-${e.kind})"></path>`;
		})}
            ${n.nodes.map((e) => {
			let t = i(e.id), n = e.y + 40, a = e.annotations.map((e) => `${r[e.type] ?? e.type}: ${e.value}`), o = e.shape === "place" ? I`<circle class="place ${e.kind}" cx=${e.x} cy=${e.y} r=${20}></circle>` : I`<rect class="trans ${e.kind}" x=${e.x - 20} y=${e.y - 20} width=${40} height=${40} rx="3"></rect>`, s = t ? e.shape === "place" ? I`<circle class="halo" cx=${e.x} cy=${e.y} r=${25}></circle>` : I`<rect class="halo" x=${e.x - 20 - 5} y=${e.y - 20 - 5} width=${50} height=${50} rx="6"></rect>` : R;
			return I`
                <g class="node ${t ? "marked" : ""}">
                  ${s}${o}
                  ${e.lines.map((t, r) => I`<text class="node-label" x=${e.x} y=${n + r * 14}>${t}</text>`)}
                  ${a.map((t, r) => I`<text class="node-ann" x=${e.x} y=${n + e.lines.length * 14 + 2 + r * 13}>${t}</text>`)}
                </g>`;
		})}
          </svg>
        </div>
      </section>
    `;
	}
	_markers() {
		return I`
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
		let t = this.t, n = (e, t) => I`
      <svg class="sample" width="48" height="16" viewBox="0 0 48 16" aria-hidden="true">
        ${this._markers()}
        <path class=${e} d="M2,8 L44,8" marker-end=${t}></path>
      </svg>`;
		return F`
      <section class="legend" aria-label=${t.legendHeading}>
        <h3>${t.legendHeading}</h3>
        <ul>
          ${e ? F`
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
              ` : F`
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
		this.styles = [Y, o`
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin-bottom: 12px;
      }
      .segmented {
        display: inline-flex;
        border: 1px solid var(--primary-color);
        border-radius: 8px;
        overflow: hidden;
      }
      .segmented button {
        border: none;
        border-radius: 0;
        color: var(--primary-color);
        background: transparent;
      }
      .segmented button.on {
        color: var(--text-primary-color);
        background-color: var(--primary-color);
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
function ft(e, t) {
	return e.length > t ? `${e.slice(0, t - 1)}…` : e;
}
customElements.define("ai-drafts-domain", dt);
// src/views/inventory.ts
var pt = class extends H {
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
		return F`
      ${J(e)}
      <h2>${e.inventoryHeading}</h2>
      ${this.items.length === 0 ? F`<p class="muted">${e.inventoryEmpty}</p>` : R}
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
		return F`
      <li class="card">
        <div class="head">
          <h3>${e.alias}</h3>
          ${e.isNew ? F`<span class="badge proposal">${t.newBadge}</span>` : R}
        </div>
        <p class="summary">
          <span class="part">${n.triggers.map((e) => e.text).join(", ")}</span>
          <span class="arrow" aria-hidden="true">${t.summaryArrow}</span>
          <span class="part"
            >${n.effects.map((e) => e.delay ? `${t.after(et(e.delay, r))}: ${e.text}` : e.text).join(", ")}</span
          >
        </p>
        <dl class="facts">
          <dt>${t.condition}</dt>
          <dd>${n.conditions.length ? n.conditions.map((e) => e.text).join(", ") : t.none}</dd>
          <dt>${n.rooms.length === 1 ? t.room : t.rooms}</dt>
          <dd>${n.rooms.length ? n.rooms.join(", ") : t.none}</dd>
          ${e.mode ? F`<dt>${t.modeLabel}</dt><dd>${e.mode}</dd>` : R}
          <dt>${t.dependenciesHeading}</dt>
          <dd>
            ${o.length === 0 ? F`<span class="muted">${t.noDependencies}</span>` : o.map((e) => F`<div class="dep">${e}</div>`)}
          </dd>
        </dl>
        <div class="actions">
          <button
            type="button"
            class="secondary"
            @click=${() => q(this, "focus-automation", { automationId: e.id })}
          >
            ${t.showInDomainView}
          </button>
        </div>
      </li>
    `;
	}
	static {
		this.styles = [Y, o`
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
customElements.define("ai-drafts-inventory", pt);
// src/logic/yaml.ts
var mt = /^[\p{L}_][\p{L}\p{N}_ ./-]*$/u, ht = /^(true|false|yes|no|on|off|y|n|null|~)$/i;
function X(e) {
	return e === null ? "null" : typeof e == "string" ? mt.test(e) && !ht.test(e) && !e.endsWith(" ") ? e : JSON.stringify(e) : String(e);
}
function gt(e) {
	return typeof e != "object" || !e;
}
function _t(e) {
	return typeof e == "object" && !!e && (Array.isArray(e) ? e.length === 0 : Object.keys(e).length === 0);
}
function vt(e) {
	return Array.isArray(e) ? "[]" : typeof e == "object" && e ? "{}" : X(e);
}
function yt(e, t) {
	let n = [];
	if (Array.isArray(e)) for (let r of e) if (gt(r) || _t(r)) n.push(`${t}- ${vt(r)}`);
	else {
		let [e, ...i] = yt(r, `${t}  `);
		n.push(`${t}- ${e.slice(t.length + 2)}`, ...i);
	}
	else if (typeof e == "object" && e) for (let [r, i] of Object.entries(e)) gt(i) || _t(i) ? n.push(`${t}${X(r)}: ${vt(i)}`) : n.push(`${t}${X(r)}:`, ...yt(i, `${t}  `));
	return n;
}
function bt(e) {
	return gt(e) || _t(e) ? vt(e) : yt(e, "").join("\n");
}
// src/views/proposal.ts
var xt = class extends H {
	static {
		this.properties = {
			t: { attribute: !1 },
			language: { attribute: !1 },
			proposal: { attribute: !1 },
			description: { attribute: !1 },
			mode: { attribute: !1 }
		};
	}
	render() {
		let e = this.t, t = this.proposal;
		return t ? F`
      ${J(e)}
      <section class="card">
        <div class="head">
          <h2>${e.proposalHeading}</h2>
          <span class="badge ${t.status}">${ze(e, t.status)}</span>
        </div>
        <p class="request">“${t.request}”</p>
        ${this._renderSummary()}
      </section>
      <section class="card">
        <h2>${e.findingsHeading}</h2>
        ${t.findings.length === 0 ? F`<p class="muted">${e.noFindings}</p>` : F`<ul class="findings">
              ${t.findings.map((e) => this._renderFinding(e))}
            </ul>`}
      </section>
      <section class="card">${this._renderYaml(t)}</section>
      <section class="card">${this._renderDecision(t)}</section>
    ` : F`
        ${J(e)}
        <section class="card">
          <p class="muted">${e.noProposal}</p>
          <button type="button" class="secondary" @click=${() => q(this, "goto-request")}>
            ${e.toRequest}
          </button>
        </section>
      `;
	}
	_renderSummary() {
		let e = this.t, t = this.description;
		if (!t) return R;
		let n = {
			hour: e.unitHour,
			minute: e.unitMinute,
			second: e.unitSecond
		}, r = (e, t) => t ? F`${e} <span class="muted">(${t})</span>` : F`${e}`, i = this.mode === "restart" ? e.modeRestart : this.mode === "single" ? e.modeSingle : this.mode;
		return F`
      <h3>${e.summaryHeading}</h3>
      <dl class="facts">
        <dt>${e.trigger}</dt>
        <dd>${t.triggers.map((e) => F`<div>${r(e.text, e.room)}</div>`)}</dd>
        <dt>${e.condition}</dt>
        <dd>
          ${t.conditions.length === 0 ? e.none : t.conditions.map((e) => F`<div>${r(e.text, e.room)}</div>`)}
        </dd>
        <dt>${e.effect}</dt>
        <dd>
          ${t.effects.map((t) => F`<div>
              ${t.delay ? F`<span class="muted">${e.after(et(t.delay, n))}:</span> ` : R}${r(t.text, t.room)}
            </div>`)}
        </dd>
        <dt>${t.rooms.length === 1 ? e.room : e.rooms}</dt>
        <dd>${t.rooms.length ? t.rooms.join(", ") : e.none}</dd>
        ${i ? F`<dt>${e.modeLabel}</dt><dd>${i}</dd>` : R}
      </dl>
    `;
	}
	_renderFinding(e) {
		let t = this.t, n = e.severity === "error" ? t.severityError : e.severity === "warning" ? t.severityWarning : t.severityInfo;
		return F`
      <li class="finding">
        <div class="line">
          <span class="badge ${e.severity}">${n}</span>
          <code class="check">${e.check}</code>
        </div>
        <p>${e.message}</p>
        ${e.net_refs.length > 0 ? F`<button
              type="button"
              class="secondary"
              @click=${() => q(this, "show-finding", { netRefs: e.net_refs })}
            >
              ${t.showInDomain}
            </button>` : R}
      </li>
    `;
	}
	_renderYaml(e) {
		let t = this.t, n = e.operations.flatMap((e) => e.after ? [bt(e.after)] : []);
		return F`
      <details>
        <summary>${t.yamlSummary}</summary>
        <p class="muted note">${t.yamlNote}</p>
        ${n.map((e) => F`<pre class="yaml">${e}</pre>`)}
      </details>
    `;
	}
	_renderDecision(e) {
		let t = this.t, n = (e) => () => q(this, e), r = e.decided ? t.decidedAt(new Intl.DateTimeFormat(this.language, {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(new Date(e.decided))) : null, i = {
			applied: t.stateApplied,
			reverted: t.stateReverted,
			discarded: t.stateDiscarded,
			failed: t.stateFailed
		};
		return F`
      <div class="actions">
        ${e.status === "checked" || e.status === "draft" ? F`
              <button type="button" ?disabled=${!We(e, "apply")} @click=${n("apply")}>
                ${t.apply}
              </button>
              <button
                type="button"
                class="danger"
                ?disabled=${!We(e, "discard")}
                @click=${n("discard")}
              >
                ${t.discard}
              </button>
            ` : R}
        ${e.status === "applied" ? F`<button type="button" class="secondary" @click=${n("revert")}>
              ${t.revert}
            </button>` : R}
        ${e.status === "reverted" || e.status === "discarded" ? F`<button type="button" class="secondary" @click=${() => q(this, "goto-request")}>
              ${t.toRequest}
            </button>` : R}
      </div>
      ${Ue(e) && e.status === "checked" ? F`<p class="muted note">${t.blockedByErrors}</p>` : R}
      ${i[e.status] ? F`<p class="state" role="status">${i[e.status]}</p>` : R}
      ${r ? F`<p class="muted note">${r}</p>` : R}
    `;
	}
	static {
		this.styles = [Y, o`
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .head h2 {
        margin: 0;
      }
      .request {
        margin: 8px 0 16px;
        font-style: italic;
      }
      .findings {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .finding {
        padding: 12px 0;
        border-top: 1px solid var(--divider-color);
      }
      .finding:first-child {
        padding-top: 0;
        border-top: none;
      }
      .finding:last-child {
        padding-bottom: 0;
      }
      .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        margin-bottom: 6px;
      }
      .check {
        font-size: 12px;
        color: var(--secondary-text-color);
        overflow-wrap: anywhere;
      }
      summary {
        cursor: pointer;
        font-weight: 500;
      }
      .note {
        margin: 8px 0 0;
        font-size: 13px;
      }
      .yaml {
        margin: 8px 0 0;
        padding: 12px;
        overflow-x: auto;
        font-family: var(--code-font-family, monospace);
        font-size: 13px;
        line-height: 1.45;
        color: var(--primary-text-color);
        background-color: var(--secondary-background-color);
        border-radius: 8px;
      }
      .state {
        margin: 12px 0 0;
      }
    `];
	}
};
customElements.define("ai-drafts-proposal", xt);
// src/views/request.ts
var St = class extends H {
	static {
		this.properties = {
			t: { attribute: !1 },
			language: { attribute: !1 },
			info: { attribute: !1 },
			history: { attribute: !1 },
			proposal: { attribute: !1 },
			exampleRequest: { attribute: !1 },
			_text: { state: !0 }
		};
	}
	constructor() {
		super(), this._text = "";
	}
	render() {
		let e = this.t;
		return F`
      ${J(e)} ${this._renderInfo()}
      <section class="card">
        <h2>${e.requestHeading}</h2>
        <label for="request">${e.requestLabel}</label>
        <textarea
          id="request"
          rows="3"
          .value=${this._text}
          placeholder=${e.requestPlaceholder}
          @input=${(e) => {
			this._text = e.target.value;
		}}
        ></textarea>
        <div class="suggestion">
          <button
            class="secondary"
            type="button"
            @click=${() => {
			this._text = this.exampleRequest;
		}}
          >
            ${e.useExample}
          </button>
          <span class="muted example">“${this.exampleRequest}”</span>
        </div>
        <div class="actions">
          <button
            type="button"
            ?disabled=${this._text.trim() === ""}
            @click=${() => q(this, "create-draft")}
          >
            ${e.createDraft}
          </button>
        </div>
        <p class="muted hint">${e.createHint}</p>
      </section>
      <section class="card">
        <h2>${e.historyHeading}</h2>
        ${this._renderHistory()}
      </section>
    `;
	}
	_renderInfo() {
		let e = this.t, t = this.info;
		if (t.status === "loading") return F`<p class="muted">${e.loading}</p>`;
		if (t.status === "error") return F`
        <div class="error" role="alert">
          <p>${e.error}</p>
          <p class="detail">${t.message}</p>
          <button type="button" @click=${() => q(this, "retry-info")}>${e.retry}</button>
        </div>
      `;
		let { info: n } = t, r = n.model_source === "ai_task" ? e.sourceAiTask : n.model_source === "openai_compatible" ? e.sourceOpenai : "–", i = n.model ?? (n.model_source === "ai_task" ? e.preferredAiTask : "–");
		return F`
      <p class="info muted">
        <span>${e.version} ${n.version}</span>
        <span>${e.modelSource}: ${r}</span>
        <span>${e.model}: ${i}</span>
      </p>
    `;
	}
	_renderHistory() {
		let e = this.t, t = [...this.proposal ? [this.proposal] : [], ...this.history];
		if (t.length === 0) return F`<p class="muted">${e.historyEmpty}</p>`;
		let n = new Intl.DateTimeFormat(this.language, {
			dateStyle: "medium",
			timeStyle: "short"
		});
		return F`
      <ul class="history">
        ${t.map((t) => {
			let r = t.findings.filter((e) => e.severity === "error"), i = t.id === this.proposal?.id;
			return F`
            <li>
              <div class="line">
                <span class="badge ${t.status}">${ze(e, t.status)}</span>
                <span class="when muted">${n.format(new Date(t.created))}</span>
                ${t.rounds > 0 ? F`<span class="muted">${e.roundsLabel(t.rounds)}</span>` : R}
                ${i ? F`<button
                      class="secondary open"
                      type="button"
                      @click=${() => q(this, "open-proposal")}
                    >
                      ${e.openProposal}
                    </button>` : R}
              </div>
              <div class="text">${t.request}</div>
              ${t.status === "failed" ? r.map((e) => F`<div class="finding-text">${e.message}</div>`) : R}
            </li>
          `;
		})}
      </ul>
    `;
	}
	static {
		this.styles = [Y, o`
      label {
        display: block;
        margin-bottom: 6px;
        color: var(--secondary-text-color);
      }
      textarea {
        box-sizing: border-box;
        width: 100%;
        padding: 8px 12px;
        font: inherit;
        color: var(--primary-text-color);
        background-color: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        resize: vertical;
      }
      .suggestion {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin: 8px 0 12px;
      }
      .example {
        font-size: 14px;
      }
      .hint {
        margin: 12px 0 0;
        font-size: 13px;
      }
      .info {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 16px;
        margin: 0 0 16px;
        font-size: 13px;
      }
      .error {
        margin-bottom: 16px;
        padding: 12px 16px;
        color: var(--error-color);
        border: 1px solid var(--error-color);
        border-radius: 8px;
      }
      .error .detail {
        color: var(--secondary-text-color);
        font-family: var(--code-font-family, monospace);
        font-size: 0.9em;
      }
      .history {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .history li {
        padding: 12px 0;
        border-top: 1px solid var(--divider-color);
      }
      .history li:first-child {
        padding-top: 0;
        border-top: none;
      }
      .history li:last-child {
        padding-bottom: 0;
      }
      .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        margin-bottom: 4px;
        font-size: 13px;
      }
      .open {
        margin-left: auto;
        padding: 4px 12px;
      }
      .finding-text {
        margin-top: 4px;
        font-size: 13px;
        color: var(--error-color);
      }
    `];
	}
};
customElements.define("ai-drafts-request", St);
// src/ai-drafts-panel.ts
var Ct = [
	"request",
	"proposal",
	"domain",
	"inventory"
], Z = qe(Me, Ne), Q = String(U.operations[0]?.after?.id ?? ""), wt = new Map([...je.map((e) => [e.id, e.alias]), [Q, String(U.operations[0]?.after?.alias ?? "")]]), $ = Ye(Z), Tt = new Map(Z.places.map((e) => [e.id, e.label])), Et = class extends H {
	static {
		this.properties = {
			hass: { attribute: !1 },
			narrow: { type: Boolean },
			route: { attribute: !1 },
			panel: { attribute: !1 },
			_info: { state: !0 },
			_tab: { state: !0 },
			_proposal: { state: !0 },
			_marks: { state: !0 },
			_focus: { state: !0 },
			_mode: { state: !0 }
		};
	}
	constructor() {
		super(), this._requested = !1, this._onCreateDraft = () => {
			this._proposal = { ...U }, this._marks = W, this._focus = null, this._go("proposal");
		}, this._onShowFinding = (e) => {
			this._marks = Qe(Z, e.detail.netRefs), this._focus = null, this._go("domain");
		}, this._onFocusAutomation = (e) => {
			let { automationId: t, toggle: n } = e.detail;
			this._focus = n && this._focus === t ? null : t, n || (this._marks = W, this._go("domain"));
		}, this._info = { status: "loading" }, this._tab = "request", this._proposal = null, this._marks = W, this._focus = null, this._mode = "house";
	}
	willUpdate() {
		this.hass && !this._requested && (this._requested = !0, this._loadInfo());
	}
	async _loadInfo() {
		this._info = { status: "loading" };
		try {
			let e = await this.hass.callWS({ type: "ai_drafts/info" });
			this._info = {
				status: "ready",
				info: e
			};
		} catch (e) {
			let t = e && typeof e == "object" && "message" in e ? String(e.message) : String(e);
			this._info = {
				status: "error",
				message: t
			};
		}
	}
	get _proposalLive() {
		let e = this._proposal?.status;
		return e === "checked" || e === "draft" ? "open" : e === "applied" ? "applied" : null;
	}
	_alias(e) {
		return wt.get(e) ?? e;
	}
	_domainAutomations() {
		let e = this._proposalLive;
		return $.filter((t) => t.id !== Q || e !== null).map((t) => ({
			info: t,
			alias: this._alias(t.id),
			isProposal: t.id === Q && e === "open"
		}));
	}
	_inventoryItems() {
		return $.filter((e) => e.id !== Q || this._proposalLive === "applied").map((e) => ({
			id: e.id,
			alias: this._alias(e.id),
			mode: e.mode,
			description: Ke(e, Ae),
			isNew: e.id === Q
		}));
	}
	_decide(e) {
		this._proposal && (this._proposal = Ge(this._proposal, e), this._proposalLive === null && (this._marks = W, this._focus === Q && (this._focus = null)));
	}
	_go(e) {
		this._tab = e;
	}
	render() {
		let e = Re(this.hass?.locale?.language ?? this.hass?.language), t = this.hass?.locale?.language ?? this.hass?.language, n = {
			request: e.tabRequest,
			proposal: e.tabProposal,
			domain: e.tabDomain,
			inventory: e.tabInventory
		};
		return F`
      <div class="header">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">${e.title}</div>
      </div>
      <div class="tabs" role="tablist">
        ${Ct.map((e) => F`<button
            type="button"
            role="tab"
            id="tab-${e}"
            aria-selected=${this._tab === e ? "true" : "false"}
            aria-controls="view-${e}"
            class=${this._tab === e ? "active" : ""}
            @click=${() => this._go(e)}
          >
            ${n[e]}
          </button>`)}
      </div>
      <div
        class="content"
        @create-draft=${this._onCreateDraft}
        @open-proposal=${() => this._go("proposal")}
        @goto-request=${() => this._go("request")}
        @retry-info=${() => void this._loadInfo()}
        @show-finding=${this._onShowFinding}
        @focus-automation=${this._onFocusAutomation}
        @clear-marks=${() => this._marks = W}
        @clear-focus=${() => this._focus = null}
        @set-mode=${(e) => this._mode = e.detail.mode}
        @apply=${() => this._decide("apply")}
        @discard=${() => this._decide("discard")}
        @revert=${() => this._decide("revert")}
      >
        ${this._renderViews(e, t)}
      </div>
    `;
	}
	_renderViews(e, t) {
		let n = $.find((e) => e.id === Q) ?? null;
		return F`
      <div class="view" id="view-request" role="tabpanel" ?hidden=${this._tab !== "request"}>
        <ai-drafts-request
          .t=${e}
          .language=${t}
          .info=${this._info}
          .history=${Fe}
          .proposal=${this._proposal}
          .exampleRequest=${U.request}
        ></ai-drafts-request>
      </div>
      <div class="view" id="view-proposal" role="tabpanel" ?hidden=${this._tab !== "proposal"}>
        <ai-drafts-proposal
          .t=${e}
          .language=${t}
          .proposal=${this._proposal}
          .description=${n ? Ke(n, Ae) : null}
          .mode=${n?.mode ?? null}
        ></ai-drafts-proposal>
      </div>
      <div class="view wide" id="view-domain" role="tabpanel" ?hidden=${this._tab !== "domain"}>
        <ai-drafts-domain
          .t=${e}
          .language=${t}
          .house=${Ae}
          .net=${Z}
          .automations=${this._domainAutomations()}
          .marks=${this._marks}
          .focusId=${this._focus}
          .mode=${this._mode}
        ></ai-drafts-domain>
      </div>
      <div class="view" id="view-inventory" role="tabpanel" ?hidden=${this._tab !== "inventory"}>
        <ai-drafts-inventory
          .t=${e}
          .items=${this._inventoryItems()}
          .dependencies=${Ze($.filter((e) => e.id !== Q || this._proposalLive === "applied"))}
          .stateLabelOf=${(e) => Tt.get(e) ?? e}
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
    .tabs {
      display: flex;
      overflow-x: auto;
      background-color: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color));
      scrollbar-width: none;
    }
    .tabs button {
      flex: none;
      padding: 12px 16px;
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      color: inherit;
      white-space: nowrap;
      cursor: pointer;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      opacity: 0.75;
    }
    .tabs button.active {
      border-bottom-color: currentColor;
      opacity: 1;
    }
    .tabs button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: -4px;
    }
    .content {
      padding: 16px;
    }
    .view {
      max-width: 760px;
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
customElements.define("ai-drafts-panel", Et);
