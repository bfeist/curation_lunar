export interface Sample {
  id: string;
  mission: string | null;
  station: string | null;
  landmark: string | null;
  bagNumber: string | null;
  weight: number | null;
  type: string | null;
  subtype: string | null;
  pristine: number | null;
  pristinityDate: string | null;
  thinSections: number | null;
  displays: number | null;
  description: string | null;
  sourceUrl: string | null;
  status: string;
}
export interface Asset {
  url: string;
  label: string;
  alt: string | null;
  role: string;
}
export interface Photo {
  id: string;
  mission: string | null;
  type: string | null;
  subtype: string | null;
  film: string | null;
  description: string | null;
  orientation: string | null;
  angle: string | null;
  specifics: string | null;
  sourceUrl: string | null;
  status: string;
  preview: string | null;
}
export interface Reference {
  id: string;
  authors: string | null;
  year: string | null;
  title: string | null;
  citation: string | null;
  links: string[];
  samples: string[];
}
export interface SampleDetail {
  sample: Sample;
  photos: Photo[];
  publications: { id: string; title: string; url: string }[];
  references: Reference[];
  sections: {
    id: string;
    specific: string;
    weight: number | null;
    description: string | null;
    availability: string | null;
  }[];
  locations: {
    id: string;
    specific: string;
    name: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    url: string | null;
    description: string | null;
  }[];
}
export interface PhotoDetail {
  photo: Photo;
  samples: string[];
  assets: Asset[];
}
export interface Results<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface EditorialPage {
  title: string;
  sourceUrl: string;
  html: string;
}
export interface Vocabulary {
  missions: string[];
  types: string[];
  subtypes: string[];
  stations: string[];
  landmarks: string[];
  photoTypes: string[];
  photoSubtypes: string[];
  filmTypes: string[];
}
export interface DatasetInfo {
  label: string;
  samples: number;
  photos: number;
  pages: number;
}
