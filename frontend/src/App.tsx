import { useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');

    console.log('DATA:', data);
    console.log('ERROR:', error);
  }

  return <h1>MindNavy LMS</h1>;
}

export default App;