import React, { useState } from 'react';
import { FaSun, FaUpload, FaSpinner, FaArrowLeft } from 'react-icons/fa';
import { useViewStateCache } from '../../hooks/useViewStateCache';
import './SolarAnalysis.css';

interface AnalysisResult {
  location: {
    city: string;
    latitude: number;
    longitude: number;
    elevation: number;
  };
  statistics: {
    prevailing_directions: number[];
    wind_speed: {
      average_ms: number;
      maximum_ms: number;
      minimum_ms: number;
    };
  };
  plot_base64: string;
}

interface SolarAnalysisProps {
  onBack: () => void;
}

interface CachedState {
  file: File | null;
  fileName: string | null;
  result: AnalysisResult | null;
  error: string | null;
}

const SolarAnalysis: React.FC<SolarAnalysisProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cache: restoruje state na mount, ulozí na unmount
  useViewStateCache<CachedState>(
    'solar',
    { file, fileName, result, error },
    (cached) => {
      setFile(cached.file);
      setFileName(cached.fileName);
      setResult(cached.result);
      setError(cached.error);
    }
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Prosím vyberte EPW soubor');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/analysis/wind-rose', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Chyba při analýze');
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="solar-analysis-container">
      <button onClick={onBack} className="back-button">
        <FaArrowLeft /> Zpět na přehled
      </button>

      <div className="analysis-header">
        <FaSun size={48} color="#f39c12" />
        <h1>Analýza EPW dat o počasí</h1>
        <p>Nahrajte EPW soubor pro analýzu klimatických podmínek</p>
      </div>

      <div className="upload-area">
        <input
          type="file"
          accept=".epw"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          id="epw-upload"
        />
        <label htmlFor="epw-upload" className="upload-label">
          <FaUpload size={32} color="#3498db" />
          <p>{fileName ? fileName : 'Klikněte pro výběr EPW souboru'}</p>
        </label>
        
        {!file && fileName && (
          <p className="cache-hint">Soubor se nepodařilo obnovit — vyberte prosím znovu.</p>
        )}

        {file && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="upload-button"
          >
            {loading ? (
              <>
                <FaSpinner className="spinner" /> Analyzuji...
              </>
            ) : (
              'Spustit analýzu'
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {result && (
        <div className="results-container">
          <h2>Výsledky analýzy</h2>
          
          <div className="result-card">
            <h3>Lokace</h3>
            <p><strong>Město:</strong> {result.location.city}</p>
            <p><strong>Souřadnice:</strong> {result.location.latitude}°N, {result.location.longitude}°E</p>
            <p><strong>Nadmořská výška:</strong> {result.location.elevation} m</p>
          </div>

          <div className="result-card">
            <h3>Větrné statistiky</h3>
            <p><strong>Převládající směr:</strong> {result.statistics.prevailing_directions[0]}°</p>
            <p><strong>Průměrná rychlost:</strong> {result.statistics.wind_speed.average_ms} m/s</p>
            <p><strong>Maximální rychlost:</strong> {result.statistics.wind_speed.maximum_ms} m/s</p>
          </div>

          <div className="wind-rose-container">
            <h3>Větrná růžice</h3>
            <img 
              src={result.plot_base64} 
              alt="Wind Rose" 
              className="wind-rose-image"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SolarAnalysis;