import { Redirect, useLocalSearchParams } from 'expo-router';

// Unified into the single Race Center at /race/[id]. Kept as a redirect so any older
// deep link (/event/<id>) still resolves to the pro race.
export default function EventRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/race/${id}?kind=pro`} />;
}
