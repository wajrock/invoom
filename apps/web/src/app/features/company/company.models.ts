export interface CompanyField {
    id: string;
    group: string;
    label: string;
    value: string;
}

export interface Company {
    fields: CompanyField[];
}
