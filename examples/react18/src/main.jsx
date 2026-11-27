import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DatePicker } from 'consistent-date-picker/react';

function App() {
  const [value, setValue] = useState('');
  const [changes, setChanges] = useState({ count: 0, last: '' });
  const [submitted, setSubmitted] = useState('');

  // The wrapper's onDateChange gets the real event, so detail.value is there
  const onDateChange = (e) => {
    setValue(e.detail.value);
    setChanges((c) => ({ count: c.count + 1, last: e.detail.value }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(JSON.stringify(Object.fromEntries(new FormData(e.target))));
  };

  return (
    <main>
      <form id="form" onSubmit={onSubmit}>
        <DatePicker id="picker" name="when" label="Meeting date" required selectedDate={value} onDateChange={onDateChange} />
        <button type="submit">Submit</button>
      </form>
      <button id="set-outside" type="button" onClick={() => setValue('4/3/2023')}>Set from outside</button>
      <output id="changes">count: {changes.count}, last: {changes.last}</output>
      <pre id="submitted">{submitted}</pre>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
