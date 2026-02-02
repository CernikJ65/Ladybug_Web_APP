"""Analýza větrné růžice pomocí Ladybug API."""
from typing import Dict, Any, Optional
from ladybug.epw import EPW
from ladybug.windrose import WindRose


class WindRoseAnalyzer:
    """Analyzuje větrné podmínky z EPW dat."""
    
    def __init__(self, epw_data: EPW):
        self.epw_data = epw_data
        self.wind_rose: Optional[WindRose] = None
    
    def create_wind_rose(self, direction_count: int = 16) -> WindRose:
        """Vytvoří větrnou růžici."""
        wind_direction = self.epw_data.wind_direction
        wind_speed = self.epw_data.wind_speed
        
        self.wind_rose = WindRose(
            direction_data_collection=wind_direction,
            analysis_data_collection=wind_speed,
            direction_count=direction_count
        )
        return self.wind_rose
    
    def get_statistics(self) -> Dict[str, Any]:
        """Získá větrné statistiky."""
        if not self.wind_rose:
            self.create_wind_rose()
        
        wind_speed_data = self.epw_data.wind_speed
        wind_direction_data = self.epw_data.wind_direction
        prevailing = self.wind_rose.prevailing_direction
        
        return {
            "prevailing_directions": prevailing,
            "wind_speed": {
                "average_ms": round(wind_speed_data.average, 2),
                "maximum_ms": round(wind_speed_data.max, 2),
                "minimum_ms": round(wind_speed_data.min, 2)
            },
            "wind_direction": {
                "average_degrees": round(wind_direction_data.average, 1),
                "most_common_degrees": prevailing[0] if prevailing else None
            },
            "data_period": {
                "total_hours": len(wind_speed_data.values)
            }
        }