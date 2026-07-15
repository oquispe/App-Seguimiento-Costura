-- Solo lectura. ¿Qué semanas existen HOY como vigentes en carga_actual?
SELECT semana, COUNT(*) AS items
FROM carga_actual
WHERE vigente = true
GROUP BY semana
ORDER BY semana;
