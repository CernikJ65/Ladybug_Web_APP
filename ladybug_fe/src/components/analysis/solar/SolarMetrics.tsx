import React from 'react';

export const KPI: React.FC<{
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}> = ({ icon, value, label, accent }) => (
  <div className={`saa-kpi ${accent ? 'saa-kpi-accent' : ''}`}>
    <span className="saa-kpi-icon">{icon}</span>
    <span className="saa-kpi-val">{value}</span>
    <span className="saa-kpi-lbl">{label}</span>
  </div>
);

export const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="saa-detail-row">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export const SubRow: React.FC<{ label: string; value: string; emphasized?: boolean }> = ({
  label, value, emphasized,
}) => (
  <div className={`saa-sub-row ${emphasized ? 'emphasized' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);
