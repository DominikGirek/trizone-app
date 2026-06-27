import { Redirect, useLocalSearchParams } from 'expo-router';

// Unified into the single Race Center at /race/[id]. Kept as a redirect so any older
// deep link (/local/<id>) still resolves to the local race.
export default function LocalRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/race/${id}?kind=local`} />;
}
