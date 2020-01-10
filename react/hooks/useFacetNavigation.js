import { zip } from 'ramda'
import { useCallback } from 'react'
import { useRuntime } from 'vtex.render-runtime'
import { useQuery } from '../components/QueryContext'

import { HEADER_SCROLL_OFFSET } from '../constants/SearchHelpers'

const SPEC_FILTER = 'specificationFilter'
const MAP_CATEGORY_CHAR = 'c'
const MAP_QUERY_KEY = 'map'
const MAP_VALUES_SEP = ','
const PATH_SEPARATOR = '/'
const SPACE_REPLACER = '-'
const FILTER_TITLE_SEP = '_'

const scrollOptions = {
  baseElementId: 'search-result-anchor',
  top: -HEADER_SCROLL_OFFSET,
}

const selectedFacets = {}

const storeSelectedFacets = selectedFacet => {
  if (selectedFacet) {
    selectedFacets[selectedFacet.value] = selectedFacet
  }
}

const removeElementAtIndex = (str, index, separator) =>
  str
    .split(separator)
    .filter((_, i) => i !== index)
    .join(separator)

const newFacetPathName = facet => {
  const newFacetName =
    facet.map && facet.map.includes(SPEC_FILTER)
      ? `${facet.title
          .replace(/\s/g, SPACE_REPLACER)
          .toLowerCase()}${FILTER_TITLE_SEP}${facet.value.replace(
          /\s/g,
          SPACE_REPLACER
        )}`
      : facet.value
  return newFacetName
}

const removeMapForNewURLFormat = queryAndMap => {
  return queryAndMap.map
    .split(MAP_VALUES_SEP)
    .filter(
      mapValue =>
        mapValue !== MAP_CATEGORY_CHAR && !mapValue.includes(SPEC_FILTER)
    )
    .join(MAP_VALUES_SEP)
}

export const buildQueryAndMap = (inputQuery, inputMap, facets) => {
  const queryAndMap = facets.reduce(
    ({ query, map }, facet) => {
      const facetValue = newFacetPathName(facet)
      if (facet.selected) {
        const facetIndex = zip(
          query
            .toLowerCase()
            .split(PATH_SEPARATOR)
            .map(decodeURIComponent),
          map.split(MAP_VALUES_SEP)
        ).findIndex(
          ([value, valueMap]) =>
            value === decodeURIComponent(facetValue.toLowerCase()) &&
            valueMap === facet.map
        )

        return {
          query: removeElementAtIndex(query, facetIndex, PATH_SEPARATOR),
          map: removeElementAtIndex(map, facetIndex, MAP_VALUES_SEP),
        }
      }

      if (facet.map === MAP_CATEGORY_CHAR) {
        const mapArray = map.split(MAP_VALUES_SEP)
        const lastCategoryIndex = mapArray.lastIndexOf(MAP_CATEGORY_CHAR)
        if (
          lastCategoryIndex >= 0 &&
          lastCategoryIndex !== mapArray.length - 1
        ) {
          // Corner case: if we are adding a category but there are other filter other than category applied. Add the new category filter to the right of the other categories.
          const queryArray = query.split(PATH_SEPARATOR)
          return {
            query: [
              ...queryArray.slice(0, lastCategoryIndex + 1),
              facet.value,
              ...queryArray.slice(lastCategoryIndex + 1),
            ].join(PATH_SEPARATOR),
            map: [
              ...mapArray.slice(0, lastCategoryIndex + 1),
              facet.map,
              ...mapArray.slice(lastCategoryIndex + 1),
            ].join(MAP_VALUES_SEP),
          }
        }
      }

      return {
        query: `${query}${PATH_SEPARATOR}${facetValue}`,
        map: `${map}${MAP_VALUES_SEP}${facet.map}`,
      }
    },
    { query: inputQuery, map: inputMap }
  )
  queryAndMap.map = removeMapForNewURLFormat(queryAndMap)
  return queryAndMap
}

const useFacetNavigation = (map, selectedFacet) => {
  const { navigate } = useRuntime()
  const { query } = useQuery()
  storeSelectedFacets(selectedFacet)

  const navigateToFacet = useCallback(
    maybeFacets => {
      const facets = Array.isArray(maybeFacets) ? maybeFacets : [maybeFacets]

      const { query: currentQuery, map: currentMap } = buildQueryAndMap(
        query,
        map,
        facets
      )

      const urlParams = new URLSearchParams(window.location.search)
      urlParams.set(MAP_QUERY_KEY, currentMap)
      if (!currentMap) {
        urlParams.delete(MAP_QUERY_KEY)
      }

      const fieldsNotNormalizable = [
        ...facets,
        ...Object.values(selectedFacets),
      ]
        .filter(facet => facet.map !== 'c')
        .map(newFacetPathName)
        .join(PATH_SEPARATOR)
      const modifiersIgnore = {
        [fieldsNotNormalizable]: {
          path: fieldsNotNormalizable,
        },
      }

      navigate({
        to: `${PATH_SEPARATOR}${currentQuery}`,
        query: urlParams.toString(),
        scrollOptions,
        modifiersIgnore,
      })
    },
    [query, map, navigate]
  )

  return navigateToFacet
}

export default useFacetNavigation
