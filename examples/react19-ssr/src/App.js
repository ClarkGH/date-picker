// Plain createElement instead of JSX, so prerender.mjs can import it in Node without a build step
import { createElement as h, useState } from 'react';
import { DatePicker } from 'consistent-date-picker/react';

export function App() {
  const [value, setValue] = useState('');
  const [changes, setChanges] = useState({ count: 0, last: '' });
  const [submitted, setSubmitted] = useState('');

  const onDateChange = (e) => {
    setValue(e.detail.value);
    setChanges((c) => ({ count: c.count + 1, last: e.detail.value }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(JSON.stringify(Object.fromEntries(new FormData(e.target))));
  };

  return h('main', null,
    h('form', { id: 'form', onSubmit },
      h(DatePicker, { id: 'picker', name: 'when', label: 'Meeting date', required: true, selectedDate: value, onDateChange }),
      h('button', { type: 'submit' }, 'Submit'),
    ),
    h('button', { id: 'set-outside', type: 'button', onClick: () => setValue('4/3/2023') }, 'Set from outside'),
    h('output', { id: 'changes' }, `count: ${changes.count}, last: ${changes.last}`),
    h('pre', { id: 'submitted' }, submitted),
  );
}
