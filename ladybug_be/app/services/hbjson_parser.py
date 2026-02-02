"""
HBJSON parser - FINÁLNÍ verze.
1. Najdi všechny horizontální plochy
2. Seskup podle XY pozice (budovy)
3. Z každé budovy vezmi jen nejvyšší podlaží
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import math

from honeybee.model import Model
from ladybug_geometry.geometry3d.face import Face3D


@dataclass
class RoofSurface:
    """Reprezentace střešní plochy."""
    identifier: str
    geometry: Face3D
    area: float
    tilt: float
    azimuth: float
    center: tuple
    face_count: int = 1
    
    def get_orientation(self) -> str:
        if self.tilt < 5:
            return "Horizontal"
        az = self.azimuth
        if az >= 337.5 or az < 22.5:
            return "North"
        elif az >= 22.5 and az < 67.5:
            return "North-East"
        elif az >= 67.5 and az < 112.5:
            return "East"
        elif az >= 112.5 and az < 157.5:
            return "South-East"
        elif az >= 157.5 and az < 202.5:
            return "South"
        elif az >= 202.5 and az < 247.5:
            return "South-West"
        elif az >= 247.5 and az < 292.5:
            return "West"
        else:
            return "North-West"


class HBJSONParser:
    """
    Parser HBJSON - detekuje střechy budov.
    Strategie: XY clustering -> pak vezmi top Z z každého clusteru.
    """
    
    def __init__(self, hbjson_path: str):
        self.hbjson_path = hbjson_path
        self.model: Optional[Model] = None
    
    def load_model(self) -> Model:
        self.model = Model.from_hbjson(self.hbjson_path)
        return self.model
    
    def detect_roof_surfaces(
        self,
        max_tilt: float = 60.0,
        min_area: float = 10.0,  # min 10m² aby odfiltroval malé kousky
        building_distance: float = 50.0,  # XY vzdálenost mezi budovami (m)
        floor_height_tolerance: float = 3.0  # tolerance mezi podlažími (m)
    ) -> List[RoofSurface]:
        """
        Detekuje střechy - PRIMÁRNĚ podle XY pozice (budovy).
        
        Postup:
        1. Najdi všechny horizontální plochy
        2. Seskup podle XY pozice -> budovy
        3. V každé budově najdi nejvyšší podlaží
        4. Seskup plochy ve stejné výšce
        
        Args:
            max_tilt: Max sklon (stupně)
            min_area: Min plocha (m²)
            building_distance: XY vzdálenost mezi budovami (m)
            floor_height_tolerance: Tolerance Z výšky pro jedno podlaží (m)
        """
        if not self.model:
            raise ValueError("Model není načten.")
        
        # 1. Najdi všechny kandidáty
        candidates = self._get_all_candidates(max_tilt, min_area)
        
        if not candidates:
            return []
        
        # 2. XY CLUSTERING - seskup podle polohy (budovy)
        building_clusters = self._cluster_by_xy(candidates, building_distance)
        
        print(f"DEBUG: Nalezeno {len(building_clusters)} budov (XY clustering)")
        
        # 3. Pro každou budovu vezmi JEN nejvyšší podlaží
        all_roofs = []
        
        for b_idx, building in enumerate(building_clusters, 1):
            # Najdi max Z v této budově
            max_z = max(c['z'] for c in building)
            
            # Vezmi jen plochy blízko max_z
            top_floor = [c for c in building if (max_z - c['z']) <= floor_height_tolerance]
            
            print(f"  Budova {b_idx}: celkem {len(building)} ploch, top floor: {len(top_floor)} ploch na Z~{max_z:.1f}m")
            
            # Seskup plochy top floor podle Z (mohou být mírně rozdílné)
            z_clusters = self._cluster_by_z(top_floor, height_tolerance=0.5)
            
            # Vytvoř RoofSurface pro každý Z cluster
            for z_idx, z_cluster in enumerate(z_clusters, 1):
                roof = self._create_roof_from_cluster(z_cluster, f"Building{b_idx}_Roof{z_idx}")
                all_roofs.append(roof)
        
        return all_roofs
    
    def _get_all_candidates(self, max_tilt: float, min_area: float) -> List[Dict]:
        """Najdi všechny kandidáty na střechy."""
        candidates = []
        
        # Z orphaned_shades
        if hasattr(self.model, 'orphaned_shades') and self.model.orphaned_shades:
            for shade in self.model.orphaned_shades:
                geometry: Face3D = shade.geometry
                tilt = math.degrees(geometry.tilt)
                
                if tilt > max_tilt:
                    continue
                
                area = geometry.area
                if area < min_area:
                    continue
                
                normal = geometry.normal
                if normal.z < 0:  # ignoruj plochy směřující dolů
                    continue
                
                candidates.append({
                    'identifier': shade.identifier,
                    'geometry': geometry,
                    'area': area,
                    'tilt': tilt,
                    'azimuth': math.degrees(geometry.azimuth) if geometry.azimuth else 0,
                    'center': geometry.center,
                    'x': geometry.center.x,
                    'y': geometry.center.y,
                    'z': geometry.center.z
                })
        
        return candidates
    
    def _cluster_by_xy(self, candidates: List[Dict], max_distance: float) -> List[List[Dict]]:
        """Seskup podle XY pozice (ignoruje Z)."""
        if not candidates:
            return []
        
        clusters = [[candidates[0]]]
        
        for candidate in candidates[1:]:
            added = False
            
            for cluster in clusters:
                # Zkontroluj vzdálenost od JAKÉKOLIV plochy v clusteru
                for c in cluster:
                    dist = self._distance_xy(candidate, c)
                    if dist <= max_distance:
                        cluster.append(candidate)
                        added = True
                        break
                if added:
                    break
            
            if not added:
                clusters.append([candidate])
        
        return clusters
    
    def _cluster_by_z(self, candidates: List[Dict], height_tolerance: float) -> List[List[Dict]]:
        """Seskup podle Z výšky."""
        if not candidates:
            return []
        
        # Seřaď podle Z
        sorted_cands = sorted(candidates, key=lambda x: x['z'])
        
        clusters = [[sorted_cands[0]]]
        
        for cand in sorted_cands[1:]:
            # Průměrná Z aktuálního clusteru
            avg_z = sum(c['z'] for c in clusters[-1]) / len(clusters[-1])
            
            if abs(cand['z'] - avg_z) <= height_tolerance:
                clusters[-1].append(cand)
            else:
                clusters.append([cand])
        
        return clusters
    
    def _create_roof_from_cluster(self, cluster: List[Dict], identifier: str) -> RoofSurface:
        """Vytvoř RoofSurface z clusteru ploch."""
        largest = max(cluster, key=lambda x: x['area'])
        total_area = sum(c['area'] for c in cluster)
        
        avg_x = sum(c['x'] * c['area'] for c in cluster) / total_area
        avg_y = sum(c['y'] * c['area'] for c in cluster) / total_area
        avg_z = sum(c['z'] * c['area'] for c in cluster) / total_area
        avg_tilt = sum(c['tilt'] * c['area'] for c in cluster) / total_area
        avg_azimuth = sum(c['azimuth'] * c['area'] for c in cluster) / total_area
        
        return RoofSurface(
            identifier=identifier,
            geometry=largest['geometry'],
            area=total_area,
            tilt=avg_tilt,
            azimuth=avg_azimuth,
            center=(avg_x, avg_y, avg_z),
            face_count=len(cluster)
        )
    
    def _distance_xy(self, p1: Dict, p2: Dict) -> float:
        """2D vzdálenost."""
        dx = p1['x'] - p2['x']
        dy = p1['y'] - p2['y']
        return math.sqrt(dx*dx + dy*dy)
    
    def get_summary(self) -> Dict[str, Any]:
        if not self.model:
            return {}
        
        return {
            "model_name": self.model.display_name or self.model.identifier,
            "room_count": len(self.model.rooms),
            "orphaned_shade_count": len(self.model.orphaned_shades) if hasattr(self.model, 'orphaned_shades') else 0
        }