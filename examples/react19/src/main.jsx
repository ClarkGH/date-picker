import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'consistent-date-picker/define';

function App() {
  const [value, setValue] = useState('');
  const [changes, setChanges] = useState({ count: 0, last: '' });
  const [submitted, setSubmitted] = useState('');

  // React 19 hands onChange its own synthetic event, which has no `detail`. e.target is the picker
  const onChange = (e) => {
    setValue(e.target.selectedDate);
    setChanges((c) => ({ count: c.count + 1, last: e.target.selectedDate }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(JSON.stringify(Object.fromEntries(new FormData(e.target))));
  };

  return (
    <main>
      <form id="form" onSubmit={onSubmit}>
        <consistent-date-picker id="picker" name="when" label="Meeting date" required selectedDate={value} onChange={onChange} />
        <button type="submit">Submit</button>
      </form>
      <button id="set-outside" type="button" onClick={() => setValue('4/3/2023')}>Set from outside</button>
      <output id="changes">count: {changes.count}, last: {changes.last}</output>
      <pre id="submitted">{submitted}</pre>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
