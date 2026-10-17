import { HomeView } from "@/components/home/home-view";
import { getHomeData } from "@/lib/home-data";

// Rendered on the server (and cached for a minute) so visitors get real
// HTML with content and images immediately, rather than an empty shell
// that fetches everything after the JavaScript loads.
export const revalidate = 60;

export default async function HomePage() {
  const { content, courses } = await getHomeData();
  return <HomeView content={content} courses={courses} />;
}
