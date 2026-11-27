import { LitElement, html } from 'lit';
import 'consistent-date-picker/define';

class DemoApp extends LitElement {
  static properties = {
    _value: { state: true },
    _count: { state: true },
    _last: { state: true },
    _submitted: { state: true },
  };

  constructor() {
    super();
    this._value = '';
    this._count = 0;
    this._last = '';
    this._submitted = '';
  }

  // Light DOM, so the form and its ids are plain page elements, like in the other examples
  createRenderRoot() {
    return this;
  }

  _onChange(e) {
    this._value = e.detail.value;
    this._count += 1;
    this._last = e.detail.value;
  }

  _onSubmit(e) {
    e.preventDefault();
    this._submitted = JSON.stringify(Object.fromEntries(new FormData(e.target)));
  }

  render() {
    return html`
      <main>
        <form id="form" @submit=${this._onSubmit}>
          <consistent-date-picker id="picker" name="when" label="Meeting date" required
            .selectedDate=${this._value} @change=${this._onChange}></consistent-date-picker>
          <button type="submit">Submit</button>
        </form>
        <button id="set-outside" type="button" @click=${() => (this._value = '4/3/2023')}>Set from outside</button>
        <output id="changes">count: ${this._count}, last: ${this._last}</output>
        <pre id="submitted">${this._submitted}</pre>
      </main>
    `;
  }
}

customElements.define('demo-app', DemoApp);
