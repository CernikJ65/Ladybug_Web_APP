"""Vytváření grafů větrné růžice."""
import io
import base64
import matplotlib
matplotlib.use('Agg')  # Non-GUI backend
import matplotlib.pyplot as plt
import numpy as np
from ladybug.windrose import WindRose
from ladybug.epw import EPW


class WindRosePlotter:
    """Vytváří obrázky větrné růžice."""
    
    def __init__(self, wind_rose: WindRose, epw_data: EPW):
        self.wind_rose = wind_rose
        self.epw_data = epw_data
    
    def create_plot(self) -> str:
        """
        Vytvoří polární graf větrné růžice.
        Returns: Base64 encoded PNG obrázek
        """
        angles = np.array(self.wind_rose.angles)
        wind_speed = np.array(self.epw_data.wind_speed.values)
        wind_direction = np.array(self.epw_data.wind_direction.values)
        
        # Nastavení rychlostních rozsahů a barev
        speed_ranges = [0, 2, 4, 6, 8, 10, float('inf')]
        colors = plt.cm.viridis(np.linspace(0, 1, len(speed_ranges) - 1))
        
        # Vytvoření polárního grafu
        fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(projection='polar'))
        ax.set_theta_zero_location('N')
        ax.set_theta_direction(-1)
        
        width = 2 * np.pi / len(angles)
        
        # Výpočet frekvencí pro každý směr a rychlost
        for i, (speed_min, speed_max) in enumerate(zip(speed_ranges[:-1], speed_ranges[1:])):
            frequencies = self._calculate_frequencies(
                angles, wind_speed, wind_direction, speed_min, speed_max, width
            )
            
            theta = np.radians(angles)
            bottom = np.sum([frequencies for _ in range(i)], axis=0) if i > 0 else np.zeros(len(angles))
            
            label = f'{speed_min}-{speed_max if speed_max != float("inf") else "∞"} m/s'
            ax.bar(theta, frequencies, width=width, bottom=bottom,
                  label=label, color=colors[i], alpha=0.8)
        
        # Nastavení popisků
        city = self.epw_data.location.city
        prevailing = self.wind_rose.prevailing_direction[0]
        ax.set_title(f'Větrná růžice - {city}\nPřevládající směr: {prevailing:.0f}°',
                    pad=20, fontsize=14)
        ax.legend(loc='upper left', bbox_to_anchor=(0.1, 1.1))
        
        # Směrové popisky
        self._add_direction_labels(ax)
        
        plt.tight_layout()
        
        # Konverze do base64
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        plt.close()
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return f"data:image/png;base64,{img_base64}"
    
    def _calculate_frequencies(self, angles, wind_speed, wind_direction,
                               speed_min, speed_max, width):
        """Vypočítá frekvence pro každý sektor."""
        frequencies = []
        
        for angle in angles:
            angle_min = angle - width * 180 / np.pi / 2
            angle_max = angle + width * 180 / np.pi / 2
            
            if speed_max == float('inf'):
                speed_mask = wind_speed >= speed_min
            else:
                speed_mask = (wind_speed >= speed_min) & (wind_speed < speed_max)
            
            direction_mask = self._create_direction_mask(
                wind_direction, angle_min, angle_max
            )
            
            frequency = np.sum(speed_mask & direction_mask)
            frequencies.append(frequency)
        
        return frequencies
    
    def _create_direction_mask(self, wind_direction, angle_min, angle_max):
        """Vytvoří masku pro směrový filtr."""
        if angle_min < 0:
            return ((wind_direction >= angle_min + 360) | 
                   (wind_direction < angle_max))
        elif angle_max > 360:
            return ((wind_direction >= angle_min) | 
                   (wind_direction < angle_max - 360))
        else:
            return ((wind_direction >= angle_min) & 
                   (wind_direction < angle_max))
    
    def _add_direction_labels(self, ax):
        """Přidá směrové popisky (S, V, J, Z)."""
        directions = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ']
        angles_deg = np.arange(0, 360, 45)
        
        for angle, direction in zip(angles_deg, directions):
            ax.text(np.radians(angle), ax.get_ylim()[1] * 1.1, direction,
                   ha='center', va='center', fontweight='bold')