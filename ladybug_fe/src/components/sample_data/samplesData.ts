export interface SampleFile {
  id: string;
  category: 'hbjson' | 'epw';
  name: string;
  description: string;
  path: string;
  sizeKb: number;
  tags: string[];
}

export interface SampleFile {
  id: string;
  category: 'hbjson' | 'epw';
  name: string;
  description: string;
  path: string;
  sizeKb: number;
  tags: string[];
}

export const SAMPLES: SampleFile[] = [
  {
    id: 'hbjson-dum-zatepleny',
    category: 'hbjson',
    name: 'Zateplený rodinný dům',
    description:
      'Dvoupatrový rodinný dům se zateplenou obálkou. Model obsahuje rozdělení na tepelné zóny a je vhodný pro testování všech scénářů pracujících s HBJSON.',
    path: '/samples/buildings/dum_zatepleny_2patra.hbjson',
    sizeKb: 0,
    tags: ['Honeybee', 'Rezidenční'],
  },
];
