#!/usr/bin/env python3
"""Validate the maintained catalog without changing application data."""
import json
import sys
import unicodedata
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'catalog'


def key(value):
    return ''.join(c for c in unicodedata.normalize('NFKC', value).casefold() if c.isalnum())


def validate(root=ROOT):
    errors, ids, lookup, brands, brand_lookup = [], set(), {}, {}, {}
    def require(condition, message):
        if not condition:
            errors.append(message)
    def read(path):
        return json.loads(path.read_text(encoding='utf-8'))
    manifest = read(root / 'manifest.json')
    require(manifest['schemaVersion'] == 1, '不支持的 schemaVersion')
    require(type(manifest['catalogVersion']) is int and manifest['catalogVersion'] > 0, 'catalogVersion 必须为正整数')
    for brand in read(root / 'brands.json')['brands']:
        bid = brand['id']
        require(bid not in brands, f'重复品牌 ID：{bid}')
        brands[bid] = brand
        for alias in [brand['name'], *brand['aliases']]:
            require(isinstance(alias, str) and bool(key(alias)), f'{bid}: 品牌名称/别名不能为空')
            normalized = key(alias)
            require(normalized not in brand_lookup or brand_lookup[normalized] == bid, f'品牌别名冲突：{alias}')
            brand_lookup[normalized] = bid
    files = sorted((root / 'equipment').glob('*.json'))
    require(bool(files), '装备目录不能为空')
    for path in files:
        group = read(path)
        require(group['brandId'] in brands, f'{path.name}: 未知品牌')
        for item in group['equipment']:
            eid = item['id']
            require(eid not in ids, f'重复装备 ID：{eid}')
            ids.add(eid)
            try:
                uuid.UUID(eid)
            except ValueError:
                errors.append(f'{eid}: ID 必须是 UUID')
            require(item['brandId'] == group['brandId'], f'{eid}: 品牌与文件不一致')
            require(item['category'] in ['球拍', '羽毛球', '球鞋', '其他'], f'{eid}: 未知品类')
            require(type(item['isActive']) is bool, f'{eid}: isActive 必须是布尔值')
            require(type(item['revision']) is int and item['revision'] > 0, f'{eid}: revision 必须为正整数')
            require(isinstance(item['name'], str) and bool(item['name'].strip()), f'{eid}: 标准名称不能为空')
            require(isinstance(item['aliases'], list), f'{eid}: aliases 必须为数组')
            price = item['suggestedUnitPriceCny']
            require(price is None or (type(price) in [int, float] and price >= 0), f'{eid}: 价格必须非负或为空')
            names = [item['name'], item.get('nameEn'), item.get('model'), *item['aliases']]
            for alias in names:
                if alias is None:
                    continue
                require(isinstance(alias, str) and bool(key(alias)), f'{eid}: 名称/别名不能为空')
                scoped = (item['brandId'], item['category'], key(alias))
                require(scoped not in lookup or lookup[scoped] == eid,
                        f'同品牌同品类别名冲突：{alias} ({lookup.get(scoped)} / {eid})')
                lookup[scoped] = eid
    return errors, len(brands), len(ids)


if __name__ == '__main__':
    try:
        errors, brands, equipment = validate()
    except (KeyError, TypeError, ValueError, OSError, AttributeError) as error:
        print(f'目录格式错误：{error}', file=sys.stderr)
        sys.exit(1)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        sys.exit(1)
    print(f'目录校验通过：{brands} 个品牌，{equipment} 件装备。')
