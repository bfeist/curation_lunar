import {
  collections,
  curationNavigation,
  navigation,
} from "../data/navigation";
import { redesignUrl } from "../data/redesign";

export interface MenuLink {
  label: string;
  href: string;
  description?: string;
}
export interface MenuSection {
  title: string;
  links: MenuLink[];
}
export interface NavigationMenu {
  id: string;
  label: string;
  title: string;
  description: string;
  overview: MenuLink;
  sections: MenuSection[];
}
const fromLegacy = (links: readonly (readonly string[])[]): MenuLink[] =>
  links.map(([label, href]) => ({ label: label!, href: redesignUrl(href!) }));
const curation = fromLegacy(curationNavigation);
const collectionLinks = fromLegacy(collections);
const requests = fromLegacy(navigation[0]!.links);
const facilities = fromLegacy(navigation[1]!.links);
const catalogs = fromLegacy(navigation[2]!.links);
const publications = fromLegacy(navigation[3]!.links);

/** Every destination from the original global, collection and lunar menus has a home here. */
export const curationMenus: NavigationMenu[] = [
  {
    id: "collections",
    label: "Sample collections",
    title: "A solar system of discovery.",
    description:
      "Explore NASA’s astromaterials collections, from lunar samples to material returned by robotic missions.",
    overview: {
      ...curation[0]!,
      description: "Visit the Astromaterials Curation home",
    },
    sections: [
      {
        title: "The Moon & meteorites",
        links: collectionLinks.slice(0, 2).map((link) => ({
          ...link,
          description:
            link.label === "Lunar"
              ? "Apollo and Luna sample records"
              : "Explore the Antarctic meteorite collection",
        })),
      },
      {
        title: "Dust, particles & solar wind",
        links: [
          collectionLinks[2]!,
          collectionLinks[3]!,
          collectionLinks[4]!,
          collectionLinks[5]!,
        ],
      },
      {
        title: "Asteroid sample returns",
        links: collectionLinks.slice(6).map((link) => ({
          ...link,
          description: `Explore the ${link.label} collection`,
        })),
      },
    ],
  },
  {
    id: "research",
    label: "Research & resources",
    title: "Follow the evidence.",
    description:
      "Move from a sample to its imagery, collection context, catalogs, and published research.",
    overview: { label: "Explore the sample catalog", href: "/new/catalog" },
    sections: [
      {
        title: "Search & study",
        links: [
          catalogs[0]!,
          {
            label: "Photo library",
            href: "/new/photos",
            description: "Browse sample photography",
          },
          publications[2]!,
          catalogs[1]!,
        ],
      },
      {
        title: "Catalogs & compendium",
        links: [catalogs[2]!, catalogs[3]!, publications[0]!],
      },
      { title: "Lunar cores", links: catalogs.slice(4) },
    ],
  },
  {
    id: "requests",
    label: "Request & learn",
    title: "Bring lunar science closer.",
    description:
      "Find research request guidance, upcoming deadlines, and opportunities to learn from NASA’s samples.",
    overview: {
      ...curation[1]!,
      description: "View current curation request deadlines",
    },
    sections: [
      { title: "Scientific research", links: requests.slice(0, 3) },
      {
        title: "Education & public displays",
        links: [
          {
            ...curation[4]!,
            description: "Educational sample programs and resources",
          },
          requests[4]!,
          facilities[2]!,
        ],
      },
      {
        title: "Get in touch",
        links: [
          {
            label: "Lunar Curation Contacts",
            href: redesignUrl("/lunar/contacts.NOTcfm"),
            description: "Find the right curation contact",
          },
          {
            label: "Apollo Lunar Surface Journal",
            href: "https://www.hq.nasa.gov/office/pao/History/alsj/frame.html",
            description: "Explore the lunar surface mission record",
          },
        ],
      },
    ],
  },
  {
    id: "curation",
    label: "Curation & news",
    title: "The people behind the collection.",
    description:
      "Discover how lunar samples are preserved, follow collection news, and connect with Astromaterials Research and Exploration Science.",
    overview: {
      ...curation[5]!,
      description: "Astromaterials Research & Exploration Science",
    },
    sections: [
      {
        title: "Inside lunar curation",
        links: facilities.slice(0, 2).map((link) => ({
          ...link,
          description: link.label.includes("Tour")
            ? "Step inside the lunar sample laboratory"
            : "Learn how the collection is cared for",
        })),
      },
      {
        title: "News & newsletters",
        links: [curation[2]!, curation[3]!, publications[1]!],
      },
      {
        title: "Find your way",
        links: [
          { label: "Lunar Curation home", href: "/new" },
          {
            label: "Lunar Curation Contacts",
            href: redesignUrl("/lunar/contacts.NOTcfm"),
          },
          { label: "Curation site map", href: redesignUrl("/sitemap.NOTcfm") },
        ],
      },
    ],
  },
];

// Public destinations observed in the NASA.gov global navigation, 2026-09-09.
// This is a local navigation component, not an automatically syndicated NASA header.
export const nasaMenus: NavigationMenu[] = [
  {
    id: "nasa-explore",
    label: "Explore",
    title: "Explore NASA.",
    description:
      "Discover the missions, science, and people expanding our understanding of Earth and space.",
    overview: { label: "NASA home", href: "https://www.nasa.gov/" },
    sections: [
      {
        title: "Explore space",
        links: [
          { label: "Missions", href: "https://www.nasa.gov/nasa-missions/" },
          {
            label: "Humans in Space",
            href: "https://www.nasa.gov/humans-in-space/",
          },
          {
            label: "The Solar System",
            href: "https://science.nasa.gov/solar-system/",
          },
          { label: "The Universe", href: "https://science.nasa.gov/universe/" },
        ],
      },
      {
        title: "Science & discovery",
        links: [
          { label: "Earth", href: "https://science.nasa.gov/earth/" },
          { label: "Science", href: "https://science.nasa.gov/" },
          { label: "Aeronautics", href: "https://www.nasa.gov/aeronautics/" },
          { label: "Technology", href: "https://www.nasa.gov/technology/" },
        ],
      },
      {
        title: "Learn & connect",
        links: [
          {
            label: "Learning Resources",
            href: "https://www.nasa.gov/learning-resources/",
          },
          { label: "About NASA", href: "https://www.nasa.gov/about/" },
          { label: "NASA en Español", href: "https://www.nasa.gov/es/" },
          {
            label: "All Topics A–Z",
            href: "https://www.nasa.gov/a-to-z-topics-listing/",
          },
        ],
      },
    ],
  },
  {
    id: "nasa-news",
    label: "News & Events",
    title: "The latest from NASA.",
    description:
      "Follow discoveries, mission updates, events, and stories from across the agency.",
    overview: { label: "All NASA news", href: "https://www.nasa.gov/news/" },
    sections: [
      {
        title: "News & stories",
        links: [
          { label: "NASA News", href: "https://www.nasa.gov/news/" },
          { label: "NASA Blogs", href: "https://www.nasa.gov/nasa-blogs/" },
          { label: "Newsletters", href: "https://www.nasa.gov/newsletters/" },
        ],
      },
      {
        title: "Watch & participate",
        links: [
          { label: "Events", href: "https://www.nasa.gov/events/" },
          { label: "NASA Live", href: "https://www.nasa.gov/live/" },
          {
            label: "Podcasts & Audio",
            href: "https://www.nasa.gov/podcasts-and-audio/",
          },
        ],
      },
      {
        title: "For the media",
        links: [
          {
            label: "Media Resources",
            href: "https://www.nasa.gov/news/media-contacts/",
            description: "NASA media contacts and resources",
          },
          { label: "Video Series on NASA+", href: "https://plus.nasa.gov/" },
        ],
      },
    ],
  },
  {
    id: "nasa-media",
    label: "Multimedia",
    title: "See a new perspective.",
    description:
      "Explore NASA’s images, programs, audio, and digital experiences.",
    overview: {
      label: "Explore multimedia",
      href: "https://www.nasa.gov/multimedia/",
    },
    sections: [
      {
        title: "Watch & listen",
        links: [
          {
            label: "NASA+",
            href: "https://plus.nasa.gov/",
            description: "Stream NASA programs",
          },
          { label: "NASA Live", href: "https://www.nasa.gov/live/" },
          {
            label: "Podcasts & Audio",
            href: "https://www.nasa.gov/podcasts-and-audio/",
          },
        ],
      },
      {
        title: "Images & publications",
        links: [
          { label: "NASA Images", href: "https://www.nasa.gov/images/" },
          {
            label: "Image of the Day",
            href: "https://www.nasa.gov/image-of-the-day/",
          },
          { label: "e-Books", href: "https://www.nasa.gov/ebooks/" },
        ],
      },
      {
        title: "Explore on your device",
        links: [
          {
            label: "NASA Apps",
            href: "https://www.nasa.gov/apps/",
            description: "Mobile and desktop experiences",
          },
          {
            label: "Learning Resources",
            href: "https://www.nasa.gov/learning-resources/",
          },
        ],
      },
    ],
  },
];
